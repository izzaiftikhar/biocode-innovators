import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, isAdmin } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const db = createServerSupabase();
  const { data: cert } = await db
    .from("certificates")
    .select("cert_code, user_id, status, pdf_path")
    .eq("cert_code", params.code)
    .maybeSingle();

  const admin = await isAdmin(user.id);

  // Same response for "missing" and "someone else's" so codes cannot be probed.
  if (!cert || !cert.pdf_path || (cert.user_id !== user.id && !admin)) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }
  if (cert.status !== "valid" && !admin) {
    return NextResponse.json({ error: "This certificate has been revoked." }, { status: 410 });
  }

  const { data, error } = await db.storage
    .from("certificates")
    .createSignedUrl(cert.pdf_path, 60, { download: `${cert.cert_code}.pdf` });

  if (error || !data?.signedUrl) {
    console.error("Certificate download link failed:", error);
    return NextResponse.json({ error: "Could not create the download link." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
