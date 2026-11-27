"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function ResetPassword() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        if (active) setReady(false);
        return;
      }

      try {
        const { data, error: authError } =
          await createBrowserSupabase().auth.getUser();

        if (active) {
          setEmail(data.user?.email ?? "");
          setReady(!authError && !!data.user);
        }
      } catch {
        if (active) setReady(false);
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      setError("Use at least 8 characters, including a letter and a number.");
      return;
    }

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const supabase = createBrowserSupabase();

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(
          "We could not update your password. Please request a new reset link and try again."
        );
        setBusy(false);
        return;
      }

      // Sign out so /login isn't bounced to /dashboard by middleware,
      // then do a full navigation so Chrome offers to save the password.
      await supabase.auth.signOut();
      window.location.assign("/login?password=updated");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Choose a new password"
        intro="Create a new password for your BioCode Innovators account."
      />

      <section className="container-page py-14">
        <div className="mx-auto max-w-md rounded-lg border border-line bg-bg p-6 shadow-sm sm:p-8">
          {ready === null && (
            <p role="status" className="text-sm text-muted">
              Checking your reset link...
            </p>
          )}

          {ready === false && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted">
                This password reset link is invalid or has expired.
                Please request a new one.
              </p>
              <Link href="/forgot-password" className="arrow-link">
                Request a new reset link
              </Link>
            </div>
          )}

          {ready === true && (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-1 block text-sm font-semibold"
                >
                  Account email
                </label>
                <input
                  id="username"
                  name="username"
                  type="email"
                  value={email}
                  readOnly
                  autoComplete="username"
                  className="field opacity-70"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-semibold"
                >
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="field"
                  placeholder="Enter your new password"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1 block text-sm font-semibold"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="field"
                  placeholder="Enter your new password again"
                />
              </div>

              <p className="text-xs leading-5 text-muted">
                Use at least 8 characters, with at least one letter and one number.
              </p>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <button className="btn w-full" disabled={busy}>
                {busy ? "Saving..." : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}