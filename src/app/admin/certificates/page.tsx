"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Course = { id: string; title: string };
type Template = { course_id: string; file_path: string; layout: Record<string, number> };
type Certificate = {
  id: string;
  cert_code: string;
  holder_name: string;
  course_title: string;
  status: string;
  issued_at: string;
};

const FIELDS: { key: string; label: string; fallback: number }[] = [
  { key: "name_x", label: "Name: centre X", fallback: 421 },
  { key: "name_y", label: "Name: baseline Y", fallback: 300 },
  { key: "name_size", label: "Name: font size", fallback: 36 },
  { key: "id_x", label: "Certificate ID: X", fallback: 60 },
  { key: "id_y", label: "Certificate ID: Y", fallback: 40 },
];

const sectionClass = "rounded-2xl border border-current/10 p-5 md:p-6";
const inputClass =
  "mt-2 w-full rounded-xl border border-current/15 bg-transparent px-3.5 py-3 font-normal outline-none focus:border-current/40";

function defaultLayout() {
  return Object.fromEntries(FIELDS.map((f) => [f.key, String(f.fallback)]));
}

export default function AdminCertificates() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [courses, setCourses] = useState<Course[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [courseId, setCourseId] = useState("");
  const [layout, setLayout] = useState<Record<string, string>>(defaultLayout());
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [c, t, cert] = await Promise.all([
      supabase.from("courses").select("id, title").order("title"),
      supabase.from("certificate_templates").select("course_id, file_path, layout"),
      supabase
        .from("certificates")
        .select("id, cert_code, holder_name, course_title, status, issued_at")
        .order("issued_at", { ascending: false }),
    ]);

    if (c.error || t.error || cert.error) {
      setError(c.error?.message || t.error?.message || cert.error?.message || "Could not load data.");
    }

    setCourses((c.data ?? []) as Course[]);
    setTemplates((t.data ?? []) as Template[]);
    setCertificates((cert.data ?? []) as Certificate[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentTemplate = templates.find((t) => t.course_id === courseId);

  function chooseCourse(id: string) {
    setCourseId(id);
    setFile(null);
    setMessage("");
    setError("");
    const saved = templates.find((t) => t.course_id === id);
    setLayout(
      saved
        ? Object.fromEntries(FIELDS.map((f) => [f.key, String(saved.layout?.[f.key] ?? f.fallback)]))
        : defaultLayout()
    );
  }

  function numericLayout(): Record<string, number> | null {
    const result: Record<string, number> = {};
    for (const f of FIELDS) {
      const value = Number(layout[f.key]);
      if (layout[f.key].trim() === "" || !Number.isFinite(value) || value < 0) {
        setError(`"${f.label}" must be a number of 0 or more.`);
        return null;
      }
      result[f.key] = value;
    }
    return result;
  }

  async function saveTemplate() {
    setError("");
    setMessage("");

    if (!courseId) return setError("Choose a course first.");
    const numbers = numericLayout();
    if (!numbers) return;

    if (!currentTemplate && !file) return setError("Upload a blank certificate PDF for this course.");
    if (file && file.type !== "application/pdf") return setError("The template must be a PDF file.");
    if (file && file.size > 10 * 1024 * 1024) return setError("The template must be 10 MB or smaller.");

    setBusy("save");

    try {
      let filePath = currentTemplate?.file_path ?? "";

      if (file) {
        const newPath = `${courseId}/${Date.now()}-template.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("certificate-templates")
          .upload(newPath, file, { contentType: "application/pdf", upsert: false });
        if (uploadError) throw uploadError;
        filePath = newPath;
      }

      const { error: saveError } = await supabase
        .from("certificate_templates")
        .upsert({ course_id: courseId, file_path: filePath, layout: numbers }, { onConflict: "course_id" });
      if (saveError) throw saveError;

      // Remove the replaced template file so old files do not pile up.
      if (file && currentTemplate?.file_path && currentTemplate.file_path !== filePath) {
        await supabase.storage.from("certificate-templates").remove([currentTemplate.file_path]);
      }

      setFile(null);
      setMessage("Template saved. Use Preview to check the positions.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the template.");
    } finally {
      setBusy("");
    }
  }

  async function preview() {
    setError("");
    setMessage("");
    if (!courseId) return setError("Choose a course first.");
    const numbers = numericLayout();
    if (!numbers) return;

    setBusy("preview");

    try {
      const response = await fetch("/api/admin/certificates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, layout: numbers }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Could not create the preview.");
      }

      const blob = await response.blob();
      window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the preview.");
    } finally {
      setBusy("");
    }
  }

  async function act(cert: Certificate, action: "revoke" | "reissue") {
    setError("");
    setMessage("");

    let holderName: string | undefined;

    if (action === "revoke") {
      if (!window.confirm(`Revoke certificate ${cert.cert_code} for ${cert.holder_name}? The verification page will show it as revoked.`)) return;
    } else {
      const answer = window.prompt(
        "Name to print on the new certificate (leave as is to keep the same name):",
        cert.holder_name
      );
      if (answer === null) return;
      holderName = answer.trim();
    }

    setBusy(cert.id);

    try {
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, certificateId: cert.id, holderName }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string; certCode?: string; emailSent?: boolean;
      } | null;

      if (!response.ok) throw new Error(result?.error || "The action failed.");

      setMessage(
        action === "revoke"
          ? "Certificate revoked."
          : `New certificate ${result?.certCode} issued${result?.emailSent ? " and emailed to the student" : " (email could not be sent)"}.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="container-page py-10 md:py-14">
      <h1 className="text-3xl font-semibold">Certificates</h1>
      <p className="mt-2 text-muted">
        Upload a blank certificate PDF for each course, set where the name, ID and QR code go, then manage issued certificates.
      </p>

      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <section className={`${sectionClass} mt-8`}>
        <h2 className="text-xl font-semibold">Template and layout</h2>

        <label className="mt-4 block text-sm font-medium">
          Course
          <select className={inputClass} value={courseId} onChange={(e) => chooseCourse(e.target.value)}>
            <option value="">Choose a course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </label>

        {courseId && (
          <>
            <p className="mt-3 text-sm text-muted">
              {currentTemplate ? "A template is saved for this course. Upload a new PDF only to replace it." : "No template yet for this course."}
            </p>

            <label className="mt-4 block text-sm font-medium">
              Blank certificate PDF (max 10 MB)
              <input
                type="file"
                accept="application/pdf"
                className={inputClass}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <p className="mt-5 text-sm text-muted">
              Positions are in PDF points measured from the bottom-left corner (an A4 landscape page is 842 × 595).
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FIELDS.map((f) => (
                <label key={f.key} className="block text-sm font-medium">
                  {f.label}
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={layout[f.key]}
                    onChange={(e) => setLayout((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn disabled:opacity-60" disabled={busy !== ""} onClick={() => void saveTemplate()}>
                {busy === "save" ? "Saving..." : "Save template"}
              </button>
              <button type="button" className="btn-outline disabled:opacity-60" disabled={busy !== "" || !currentTemplate} onClick={() => void preview()}>
                {busy === "preview" ? "Creating preview..." : "Preview with sample name"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className={`${sectionClass} mt-8`}>
        <h2 className="text-xl font-semibold">Issued certificates</h2>

        {loading ? (
          <p className="mt-4 text-muted">Loading...</p>
        ) : certificates.length === 0 ? (
          <p className="mt-4 text-muted">No certificates have been issued yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {certificates.map((cert) => (
              <li key={cert.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/10 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{cert.holder_name}</p>
                  <p className="text-sm text-muted">
                    {cert.course_title} · {cert.cert_code} · {new Date(cert.issued_at).toLocaleDateString()}
                  </p>
                  <p className={`text-sm font-semibold ${cert.status === "valid" ? "text-green-700" : "text-red-700"}`}>
                    {cert.status === "valid" ? "Valid" : "Revoked"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a className="btn-outline" href={`/api/certificates/${cert.cert_code}/download`}>Download</a>
                  {cert.status === "valid" && (
                    <button type="button" className="btn-outline disabled:opacity-60" disabled={busy !== ""} onClick={() => void act(cert, "revoke")}>
                      Revoke
                    </button>
                  )}
                  <button type="button" className="btn-outline disabled:opacity-60" disabled={busy !== ""} onClick={() => void act(cert, "reissue")}>
                    {busy === cert.id ? "Working..." : "Reissue"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
