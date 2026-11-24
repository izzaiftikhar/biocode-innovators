"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Mode = "login" | "register";
type Note = { kind: "error" | "success"; text: string } | null;

const perks = [
  "Enrol in courses and track your progress",
  "Earn certificates with a public verification link",
  "Apply for research, fellowship and internships",
  "Follow updates, workshops and briefings",
];

const paths = {
  user: "M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
};

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0 to 3
}
const strengthLabel = ["Too weak", "Fair", "Good", "Strong"];

function Input(props: {
  id: string; name: string; label: string; icon: string; type?: string;
  autoComplete?: string; minLength?: number; value?: string; onChange?: (v: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1.5 block text-sm font-semibold">{props.label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Icon d={props.icon} /></span>
        <input
          id={props.id} name={props.name} type={props.type ?? "text"} required
          autoComplete={props.autoComplete} minLength={props.minLength}
          value={props.value} onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
          className="field !pl-11 !pr-16 focus:border-primary"
        />
        {props.trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{props.trailing}</span>}
      </div>
    </div>
  );
}

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");

  const isLogin = mode === "login";
  const score = strength(password);

  function switchMode(m: Mode) { setMode(m); setNote(null); setPassword(""); setShow(false); }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNote(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setNote({ kind: "error", text: "Accounts are not set up yet. Add the Supabase keys to .env.local to turn on login." });
      return;
    }
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const pw = String(f.get("password"));

    if (!isLogin) {
      if (pw !== String(f.get("confirm"))) return setNote({ kind: "error", text: "The two passwords do not match." });
      if (score < 1) return setNote({ kind: "error", text: "Choose a stronger password (at least 8 characters)." });
    }

    const supabase = createBrowserSupabase();
    setBusy(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setBusy(false);
      if (error) return setNote({ kind: "error", text: "Email or password is incorrect." });
      router.push("/dashboard");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password: pw, options: { data: { full_name: String(f.get("name")).trim() } },
      });
      setBusy(false);
      if (error) return setNote({ kind: "error", text: error.message });
      if (data.session) router.push("/dashboard");
      else setNote({ kind: "success", text: "Account created. Check your email to confirm it, then log in." });
    }
  }

  const toggle = (
    <button type="button" onClick={() => setShow(!show)} className="rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-surface" aria-pressed={show}>
      {show ? "Hide" : "Show"}
    </button>
  );

  return (
    <section className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-12 text-white lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(40rem 26rem at 90% -10%, rgb(34 211 238 / 0.28), transparent 60%), radial-gradient(34rem 22rem at 0% 110%, rgb(14 116 144 / 0.5), transparent 60%)" }} />
        <p className="relative font-heading text-lg font-semibold">Biocode <span className="text-accent">Innovators</span></p>
        <div className="relative">
          <p className="font-heading text-4xl font-semibold leading-tight">One account for everything at Biocode.</p>
          <ul className="mt-8 space-y-4">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-white/80">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <Icon d="M5 12l5 5L20 7" className="h-4 w-4" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/55">Biocode Innovators · Research Wing</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-surface/50 px-5 py-12 sm:px-10">
        <div className="w-full max-w-md rounded-2xl border border-line bg-bg p-7 shadow-sm sm:p-9">
          <h1 className="text-3xl font-semibold">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-muted">{isLogin ? "Log in to continue your courses and research." : "Join to learn, research and publish with Biocode."}</p>

          <div role="tablist" aria-label="Account" className="mt-7 grid grid-cols-2 rounded-lg bg-surface p-1">
            {(["login", "register"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                className={`rounded-md py-2.5 text-sm font-semibold transition ${mode === m ? "bg-bg text-primary shadow-sm" : "text-muted hover:text-ink"}`}>
                {m === "login" ? "Log in" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate={false}>
            {!isLogin && <Input id="name" name="name" label="Full name (as on certificates)" icon={paths.user} autoComplete="name" />}
            <Input id="email" name="email" type="email" label="Email" icon={paths.mail} autoComplete="email" />
            <Input id="password" name="password" type={show ? "text" : "password"} label="Password" icon={paths.lock}
              autoComplete={isLogin ? "current-password" : "new-password"} minLength={8}
              value={password} onChange={setPassword} trailing={toggle} />

            {!isLogin && (
              <>
                <div aria-live="polite">
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${score >= i ? (score === 3 ? "bg-success" : "bg-primary") : "bg-line"}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{password ? `Password strength: ${strengthLabel[score]}` : "Use 8+ characters with upper and lower case, a number and a symbol."}</p>
                </div>
                <Input id="confirm" name="confirm" type={show ? "text" : "password"} label="Confirm password" icon={paths.lock} autoComplete="new-password" minLength={8} />
              </>
            )}

            {note && (
              <p role="alert" className={`rounded-md border px-4 py-3 text-sm ${note.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"}`}>
                {note.text}
              </p>
            )}

            <button className="btn w-full !py-3.5 disabled:opacity-60" disabled={busy}>
              {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {isLogin ? "New to Biocode? " : "Already have an account? "}
            <button type="button" onClick={() => switchMode(isLogin ? "register" : "login")} className="font-semibold text-primary hover:underline underline-offset-4">
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
