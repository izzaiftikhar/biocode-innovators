"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={signOut} className="btn-outline mt-8">
      Log out
    </button>
  );
}
