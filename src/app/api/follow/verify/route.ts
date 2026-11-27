import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CookieToSet = { name: string; value: string; options: CookieOptions };
const PLATFORMS = ["linkedin", "instagram", "youtube"];

export async function POST(request: Request) {
  const store = cookies();
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: CookieToSet[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "login" }, { status: 401 });

  let body: { platform?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
  }

  const platform = String(body.platform ?? "");
  const action = String(body.action ?? "");
  if (!PLATFORMS.includes(platform) || (action !== "start" && action !== "confirm")) {
    return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
  }

  const db = createServerSupabase();
  const openedCol = `${platform}_opened_at`;
  const now = new Date().toISOString();

  if (action === "start") {
    const { error } = await db
      .from("social_follow")
      .upsert({ user_id: user.id, [openedCol]: now, updated_at: now }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ ok: false, error: "save" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: row } = await db
    .from("social_follow")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const openedAt = row ? (row as Record<string, string | null>)[openedCol] : null;
  if (!openedAt) return NextResponse.json({ ok: false, error: "notopened" }, { status: 400 });

  const { error: upError } = await db
    .from("social_follow")
    .update({ [platform]: true, updated_at: now })
    .eq("user_id", user.id);
  if (upError) return NextResponse.json({ ok: false, error: "save" }, { status: 500 });

  const { data: f } = await db
    .from("social_follow")
    .select("linkedin, instagram, youtube, completed_at")
    .eq("user_id", user.id)
    .single();

  const completed = !!(f?.linkedin && f?.instagram && f?.youtube);
  if (completed && !f?.completed_at) {
    await db.from("social_follow").update({ completed_at: now }).eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, completed });
}