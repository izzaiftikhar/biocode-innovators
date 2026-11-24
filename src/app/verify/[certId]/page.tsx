import PageHeader from "@/components/PageHeader";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Cert = {
  holder_name: string;
  title: string;
  kind: "Course" | "Internship";
  issued_at: string;
  status: string;
};

export default async function Verify({ params }: { params: { certId: string } }) {
  let cert: Cert | null = null;

  try {
    const supabase = createServerSupabase();

    const { data } = await supabase
      .from("certificates")
      .select("holder_name, course_title, issued_at, status")
      .eq("cert_code", params.certId)
      .maybeSingle();

    if (data) {
      cert = {
        holder_name: data.holder_name,
        title: data.course_title,
        kind: "Course",
        issued_at: data.issued_at,
        status: data.status,
      };
    } else {
      const { data: rows } = await supabase.rpc("verify_internship_certificate", {
        p_code: params.certId,
      });

      const row = Array.isArray(rows) ? rows[0] : null;

      if (row) {
        cert = {
          holder_name: row.certificate_name,
          title: `${row.domain || "BioCode"} Internship${row.duration ? ` (${row.duration})` : ""}`,
          kind: "Internship",
          issued_at: row.issued_at,
          status: "valid",
        };
      }
    }
  } catch {
    /* Supabase not configured yet */
  }

  return (
    <>
      <PageHeader title="Certificate verification" />
      <section className="container-page py-14">
        {cert ? (
          <dl className="max-w-md space-y-3">
            <div>
              <dt className="text-sm text-muted">Name</dt>
              <dd className="text-lg font-semibold">{cert.holder_name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{cert.kind}</dt>
              <dd>{cert.title}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Issued</dt>
              <dd>{new Date(cert.issued_at).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Status</dt>
              <dd
                className={
                  cert.status === "valid"
                    ? "font-semibold text-success"
                    : "font-semibold text-red-600"
                }
              >
                {cert.status === "valid" ? "Valid" : "Revoked"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted">
            No certificate found for ID {params.certId}. Check the ID and try again.
          </p>
        )}
      </section>
    </>
  );
}
