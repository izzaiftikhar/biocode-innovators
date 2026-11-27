"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

const rules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
];

type Msg = { kind: "error" | "info"; text: string } | null;

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<Msg>(
  params.get("error") === "link"
    ? {
        kind: "error",
        text: "That link is invalid or has expired. Please try again.",
      }
    : params.get("password") === "updated"
      ? {
          kind: "info",
          text: "Your password has been updated successfully. Please log in with your new password.",
        }
      : null
);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  function switchMode(m: "login" | "register") {
    setMode(m); setMsg(null); setUnconfirmedEmail(null); setPassword("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null); setUnconfirmedEmail(null);

    if (!configured) {
      return setMsg({ kind: "error", text: "Accounts are not set up yet. Add the Supabase keys to .env.local to turn on login." });
    }

    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim().toLowerCase();
    const supabase = createBrowserSupabase();

    if (mode === "register") {
      const name = String(f.get("name")).trim();
      if (name.length < 2) return setMsg({ kind: "error", text: "Please enter your full name." });
      if (!rules.every((r) => r.test(password))) return setMsg({ kind: "error", text: "Your password does not meet all the rules below." });
      if (password !== String(f.get("confirm"))) return setMsg({ kind: "error", text: "The two passwords do not match." });

      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      setBusy(false);
      if (error) return setMsg({ kind: "error", text: "We could not create the account. Try again in a moment." });
      if (data.session) { router.push(next); router.refresh(); return; }
      return setMsg({ kind: "info", text: "Almost done. We sent a confirmation link to your email. Open it, then log in." });
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        setUnconfirmedEmail(email);
        return setMsg({ kind: "error", text: "Please confirm your email first. Check your inbox for the link." });
      }
      return setMsg({ kind: "error", text: "Email or password is incorrect." });
    }
    router.push(next);
    router.refresh();
  }

  async function resend() {
    if (!unconfirmedEmail) return;
    await createBrowserSupabase().auth.resend({ type: "signup", email: unconfirmedEmail });
    setMsg({ kind: "info", text: "Confirmation email sent again." });
  }

  return (
    <div className="max-w-md rounded-lg border border-line bg-bg p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Log in or register">
        {(["login", "register"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
            className={mode === m ? "btn !py-2" : "btn-outline !py-2"}>
            {m === "login" ? "Log in" : "Register"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
        {mode === "register" && (
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-semibold">Full name (as it should appear on certificates)</label>
            <input id="name" name="name" required autoComplete="name" className="field" />
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-semibold">Password</label>
            {mode === "login" && <Link href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>}
          </div>
          <div className="relative">
            <input id="password" name="password" type={show ? "text" : "password"} required value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} className="field pr-20" />
            <button type="button" onClick={() => setShow(!show)} aria-pressed={show}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-sm font-semibold text-primary">
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {mode === "register" && (
            <ul className="mt-3 space-y-1 text-sm" aria-label="Password rules">
              {rules.map((r) => (
                <li key={r.label} className={r.test(password) ? "text-success" : "text-muted"}>
                  {r.test(password) ? "✓" : "○"} {r.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {mode === "register" && (
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-semibold">Confirm password</label>
            <input id="confirm" name="confirm" type={show ? "text" : "password"} required autoComplete="new-password" className="field" />
          </div>
        )}

        <button className="btn w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <div role="status" aria-live="polite" className="min-h-[1.5rem] text-sm">
          {msg && <p className={msg.kind === "error" ? "text-red-600" : "text-success"}>{msg.text}</p>}
          {unconfirmedEmail && <button type="button" onClick={resend} className="mt-2 font-semibold text-primary hover:underline">Resend confirmation email</button>}
        </div>
      </form>
    </div>
  );
}
