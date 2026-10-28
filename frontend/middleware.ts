import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const protectedRoutes = [
    "/dashboard",
    "/applications",
    "/postings",
    "/profile",
    "/privacy",
    "/settings",
    "/challenges",
    "/rewards",
    "/interview",
    "/messages",
    "/calendar",
    "/friends",
    "/leaderboard",
    "/resume-optimization",
  ];
  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

  if (!user && (isProtectedRoute || request.nextUrl.pathname === "/mfa")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("message", "Log in to keep building your internship streak.");
    return NextResponse.redirect(url);
  }

  if (user && isProtectedRoute) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assurance && requiresMfaChallenge(assurance.currentLevel, assurance.nextLevel)) {
      const url = request.nextUrl.clone();
      const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      url.pathname = "/mfa";
      url.search = "";
      url.searchParams.set("next", destination);
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
