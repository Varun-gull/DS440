import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") === "/reset-password" ? "/reset-password" : "/dashboard";
  const destination = new URL(process.env.APP_BASE_URL || request.url);
  destination.search = "";
  destination.pathname = "/forgot-password";
  if (code && code.length <= 2048) {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) destination.pathname = next;
    }
  }
  if (destination.pathname === "/forgot-password") destination.searchParams.set("message", "This link has expired or could not be verified. Request a new link and open it in the browser where you requested it.");
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
