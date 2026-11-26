
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function AuthButton({
  onNavigate,
  stacked,
}: {
  onNavigate?: () => void;
  stacked?: boolean;
}) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (!configured) return;

    const supabase = createBrowserSupabase();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setLoggedIn(!!data.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setLoggedIn(!!session?.user);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logOut() {
    const { error } = await createBrowserSupabase().auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      return;
    }

    onNavigate?.();
    router.push("/");
    router.refresh();
  }

  if (!loggedIn) {
    return (
      <Link
        href="/login"
        onClick={onNavigate}
        className={
          stacked ? "btn mt-2 w-full" : "btn !py-2 whitespace-nowrap"
        }
      >
        Login
      </Link>
    );
  }

  return (
    <span
      className={
        stacked ? "mt-2 flex flex-col gap-2" : "flex items-center gap-3"
      }
    >
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={stacked ? "btn" : "btn !py-2 whitespace-nowrap"}
      >
        Dashboard
      </Link>

      <button
        type="button"
        onClick={logOut}
        className="whitespace-nowrap text-sm font-semibold text-muted hover:text-primary"
      >
        Log out
      </button>
    </span>
  );
}
