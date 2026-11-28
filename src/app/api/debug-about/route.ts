import { NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("about_page_settings")
    .select("image_url, updated_at")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    supabaseHost: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host,
    row: data,
    error: error ? error.message : null,
  });
}
