import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = new URL(process.env.APP_BASE_URL || request.url);
  destination.search = "";
  destination.pathname = "/forgot-password";
  if (tokenHash && tokenHash.length <= 512 && (type === "recovery" || type === "email" || type === "signup")) {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) destination.pathname = type === "recovery" ? "/reset-password" : "/dashboard";
    }
  }
  if (destination.pathname === "/forgot-password") destination.searchParams.set("message", "This link has expired or has already been used. Request a new reset link.");
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
