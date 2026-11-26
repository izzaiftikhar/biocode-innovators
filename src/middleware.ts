
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path === "/profile" ||
    path.startsWith("/profile/");

  const isTeamManagement =
    path === "/admin/team" || path.startsWith("/admin/team/");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const toLogin = () => {
    const dest = request.nextUrl.clone();
    dest.pathname = "/login";
    dest.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(dest);
  };

  if (!url || !key) {
    return isProtected ? toLogin() : NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: CookieToSet[]) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    return toLogin();
  }

  if (path.startsWith("/admin") && user) {
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
    }

    const userRoles = (roles ?? []).map((item) => item.role);
    const isAdmin = userRoles.includes("admin");

    const canManageTeam =
      isAdmin ||
      userRoles.includes("research_member") ||
      userRoles.includes("mentor");

    if (!isAdmin && !(isTeamManagement && canManageTeam)) {
      return NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
    }
  }

  if (path === "/login" && user) {
    return NextResponse.redirect(
      new URL("/dashboard", request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/login",
  ],
};
