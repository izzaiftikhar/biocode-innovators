"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Shows "Login" when logged out, and "Dashboard" + "Log out" when logged in. */
export default function AuthButton({ onNavigate, stacked }: { onNavigate?: () => void; stacked?: boolean }) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logOut() {
    await createBrowserSupabase().auth.signOut();
    onNavigate?.();
    router.push("/");
    router.refresh();
  }

  if (!loggedIn) return <Link href="/login" onClick={onNavigate} className={stacked ? "btn mt-2 w-full" : "btn !py-2 whitespace-nowrap"}>Login</Link>;

  return (
    <span className={stacked ? "mt-2 flex flex-col gap-2" : "flex items-center gap-3"}>
      <Link href="/dashboard" onClick={onNavigate} className={stacked ? "btn" : "btn !py-2 whitespace-nowrap"}>Dashboard</Link>
      <button type="button" onClick={logOut} className="whitespace-nowrap text-sm font-semibold text-muted hover:text-primary">Log out</button>
    </span>
  );
}
