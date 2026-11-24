"use client";
import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function ForgotPassword() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim().toLowerCase();
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setBusy(true);
      await createBrowserSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setBusy(false);
    }
    // Same message whether or not the account exists, so nobody can probe which emails are registered.
    setDone(true);
  }

  return (
    <>
      <PageHeader title="Reset your password" intro="Enter your email and we will send you a link to choose a new password." />
      <section className="container-page py-14">
        <div className="max-w-md rounded-lg border border-line p-6 sm:p-8">
          {done ? (
            <p role="status">If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-semibold">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email" className="field" />
              </div>
              <button className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
            </form>
          )}
          <p className="mt-6 text-sm"><Link href="/login" className="arrow-link">← Back to log in</Link></p>
        </div>
      </section>
    </>
  );
}
