"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const value = String(new FormData(e.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();

    setBusy(true);
    try {
      const { error: err } =
        await createBrowserSupabase().auth.resetPasswordForEmail(value);
      if (err) {
        setError("We could not send the code. Please try again in a moment.");
        return;
      }
      setEmail(value);
      setStep("reset");
    } catch {
      setError("Something went wrong. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
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

      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (otpError) {
        setError("That code is invalid or has expired.");
        setBusy(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("We could not update your password. Please try again.");
        setBusy(false);
        return;
      }

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
        title="Reset your password"
        intro="Verify your email with a code, then choose a new password."
      />

      <section className="container-page py-14">
        <div className="mx-auto max-w-md rounded-lg border border-line bg-bg p-6 shadow-sm sm:p-8">
          {step === "email" ? (
            <form onSubmit={sendCode} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-semibold">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="field"
                  placeholder="Enter your registered email"
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button className="btn w-full" disabled={busy}>
                {busy ? "Sending..." : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={savePassword} className="space-y-5">
              <p className="text-sm text-muted">
                We sent a code to <strong>{email}</strong>.
              </p>

              <input
                type="email"
                name="username"
                value={email}
                readOnly
                autoComplete="username"
                className="field opacity-70"
              />

              <div>
                <label htmlFor="code" className="mb-1 block text-sm font-semibold">
                  Code from email
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  autoComplete="one-time-code"
                  className="field"
                  placeholder="Enter the code"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-semibold">
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
                <label htmlFor="confirm" className="mb-1 block text-sm font-semibold">
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

              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button className="btn w-full" disabled={busy}>
                {busy ? "Saving..." : "Save new password"}
              </button>
            </form>
          )}

          <p className="mt-6 text-sm">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}