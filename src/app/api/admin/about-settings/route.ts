
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      imageUrl?: unknown;
      badge?: unknown;
    } | null;

    if (
      !body ||
      typeof body.imageUrl !== "string" ||
      typeof body.badge !== "string"
    ) {
      return NextResponse.json(
        { error: "A valid image URL and badge are required." },
        { status: 400 }
      );
    }

    const imageUrl = body.imageUrl.trim();
    const badge = body.badge.trim();

    if (!badge || badge.length > 150) {
      return NextResponse.json(
        { error: "The badge must contain 1–150 characters." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Authentication is not configured." },
        { status: 500 }
      );
    }

    // Verify the user's existing Supabase session.
    const cookieStore = cookies();

    const authSupabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie updates may not be available in every context.
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in as an admin." },
        { status: 401 }
      );
    }

    // Check the admin role on the server; never trust the browser alone.
    const db = createServerSupabase();

    const { data: adminRole, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("About settings role check failed:", roleError);
      return NextResponse.json(
        { error: "Could not verify admin permissions." },
        { status: 500 }
      );
    }

    if (!adminRole) {
      return NextResponse.json(
        { error: "Only admins can update About page settings." },
        { status: 403 }
      );
    }

    // Only accept image URLs from this project's public storage bucket.
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Please upload a valid hero image first." },
        { status: 400 }
      );
    }

    const expectedStoragePrefix =
      `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/research-journal-assets/`;

    if (
      parsedUrl.protocol !== "https:" ||
      !imageUrl.startsWith(expectedStoragePrefix)
    ) {
      return NextResponse.json(
        { error: "The hero image must be uploaded to the approved image bucket." },
        { status: 400 }
      );
    }

    const { error: saveError } = await db
      .from("about_page_settings")
      .upsert(
        {
          id: 1,
          image_url: imageUrl,
          badge,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "id" }
      );

    if (saveError) {
      console.error("About settings save failed:", saveError);
      return NextResponse.json(
        { error: "Could not save About page settings." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("About settings API failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
