import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const BUCKET = "research-journal-assets";

async function authorizeAdmin() {
  const user = await getSessionUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Please sign in as an admin." },
        { status: 401 }
      ),
    };
  }

  const allowed = await isAdmin(user.id);

  if (!allowed) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Only admins can manage the homepage hero." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

export async function GET() {
  try {
    const { response } = await authorizeAdmin();
    if (response) return response;

    const db = createServerSupabase();

    const { data, error } = await db
      .from("home_hero_settings")
      .select("image_url, storage_path")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Home hero settings fetch failed:", error);
      return NextResponse.json(
        { error: "Could not load homepage hero settings." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: data?.image_url ?? "",
      storagePath: data?.storage_path ?? "",
    });
  } catch (error) {
    console.error("Home hero GET failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, response } = await authorizeAdmin();
    if (response) return response;

    const body = (await request.json().catch(() => null)) as {
      imageUrl?: unknown;
      storagePath?: unknown;
    } | null;

    if (
      !body ||
      typeof body.imageUrl !== "string" ||
      typeof body.storagePath !== "string"
    ) {
      return NextResponse.json(
        { error: "A valid uploaded image is required." },
        { status: 400 }
      );
    }

    const imageUrl = body.imageUrl.trim();
    const storagePath = body.storagePath.trim();

    if (
      !storagePath.startsWith("home-hero/") ||
      storagePath.includes("..") ||
      storagePath.length > 500
    ) {
      return NextResponse.json(
        { error: "Invalid homepage hero image path." },
        { status: 400 }
      );
    }

    const db = createServerSupabase();

    const expectedUrl = db.storage
      .from(BUCKET)
      .getPublicUrl(storagePath).data.publicUrl;

    if (imageUrl !== expectedUrl) {
      return NextResponse.json(
        { error: "The image URL does not match the uploaded storage file." },
        { status: 400 }
      );
    }

    const { data: previous } = await db
      .from("home_hero_settings")
      .select("storage_path")
      .eq("id", 1)
      .maybeSingle();

    const { error: saveError } = await db
      .from("home_hero_settings")
      .upsert(
        {
          id: 1,
          image_url: imageUrl,
          storage_path: storagePath,
          updated_at: new Date().toISOString(),
          updated_by: user!.id,
        },
        { onConflict: "id" }
      );

    if (saveError) {
      console.error("Home hero settings save failed:", saveError);
      return NextResponse.json(
        { error: "Could not save the homepage hero image." },
        { status: 500 }
      );
    }

    // Remove the previous upload after the new image is saved.
    if (previous?.storage_path && previous.storage_path !== storagePath) {
      const { error: removeError } = await db.storage
        .from(BUCKET)
        .remove([previous.storage_path]);

      if (removeError) {
        console.error("Previous hero image cleanup failed:", removeError);
      }
    }

    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Home hero POST failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { response } = await authorizeAdmin();
    if (response) return response;

    const db = createServerSupabase();

    const { data: previous, error: fetchError } = await db
      .from("home_hero_settings")
      .select("storage_path")
      .eq("id", 1)
      .maybeSingle();

    if (fetchError) {
      console.error("Home hero removal lookup failed:", fetchError);
      return NextResponse.json(
        { error: "Could not load the current hero image." },
        { status: 500 }
      );
    }

    if (previous?.storage_path) {
      const { error: removeError } = await db.storage
        .from(BUCKET)
        .remove([previous.storage_path]);

      if (removeError) {
        console.error("Home hero storage removal failed:", removeError);
        return NextResponse.json(
          { error: "Could not remove the uploaded image." },
          { status: 500 }
        );
      }
    }

    const { error: deleteError } = await db
      .from("home_hero_settings")
      .delete()
      .eq("id", 1);

    if (deleteError) {
      console.error("Home hero settings deletion failed:", deleteError);
      return NextResponse.json(
        { error: "Could not remove homepage hero settings." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Home hero DELETE failed:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
