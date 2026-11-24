"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setReady(false); return; }
    createBrowserSupabase().auth.getUser().then(({ data }) => setReady(!!data.user));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("password"));
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setError("Use at least 8 characters, with a letter and a number.");
    if (pw !== String(f.get("confirm"))) return setError("The two passwords do not match.");
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError("We could not update your password. Request a new reset link and try again.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Choose a new password" />
      <section className="container-page py-14">
        <div className="max-w-md rounded-lg border border-line p-6 sm:p-8">
          {ready === null && <p>Checking your link…</p>}
          {ready === false && <p>This reset link is invalid or has expired. <a href="/forgot-password" className="arrow-link">Request a new one →</a></p>}
          {ready && (
            <form onSubmit={onSubmit} className="space-y-5">
              <div><label htmlFor="password" className="mb-1 block text-sm font-semibold">New password</label><input id="password" name="password" type="password" required autoComplete="new-password" className="field" /></div>
              <div><label htmlFor="confirm" className="mb-1 block text-sm font-semibold">Confirm new password</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="field" /></div>
              <button className="btn w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
              <p role="status" className="text-sm text-red-600">{error}</p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
