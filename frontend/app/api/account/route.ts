import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";
import { readScannerJson, requireScannerUser, ScannerError } from "@/lib/email-scanner/security";
import { disconnectGmail } from "@/lib/email-scanner/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new ScannerError("Open CareerUp directly and try again.", 403);
    }
    const session = await requireScannerUser();
    const body = await readScannerJson(request);
    if (body.action !== "export" && body.action !== "delete") throw new ScannerError("Choose export or delete.");
    if (body.action === "delete" && body.confirmation !== "DELETE") throw new ScannerError("Type DELETE to confirm account deletion.");
    if (typeof body.password !== "string" || !body.password || body.password.length > 128) throw new ScannerError("Enter your current password.");
    const admin = getSupabaseAdminClient();
    if (!admin || !supabaseUrl || !supabaseAnonKey || !session.user.email) throw new ScannerError("Account controls are temporarily unavailable.", 503);
    const attempt = await admin.rpc("claim_careerup_account_action", { p_user_id: session.user.id });
    if (attempt.error) throw new ScannerError("Account controls are temporarily unavailable.", 503);
    if (attempt.data !== true) throw new ScannerError("Too many attempts. Wait five minutes and try again.", 429);

    // Isolated password check must not replace the browser's existing AAL2 session.
    const verifier = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await verifier.auth.signInWithPassword({ email: session.user.email, password: body.password });
    if (verified.error || verified.data.user?.id !== session.user.id) throw new ScannerError("Your password could not be verified. Try again or reset it from the login page.", 403);
    const temporaryToken = verified.data.session?.access_token;
    if (!temporaryToken) throw new ScannerError("Your password could not be verified.", 403);
    const revokedCheck = await admin.auth.admin.signOut(temporaryToken, "local");
    if (revokedCheck.error) throw new ScannerError("The security check could not finish. Please try again.", 503);

    if (body.action === "export") {
      const exported = await session.supabase.rpc("export_careerup_account");
      if (exported.error || !exported.data) throw new ScannerError("Your export could not be created. Please try again.", 503);
      return new NextResponse(JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), data: exported.data,
        exclusions: ["Passwords and authentication credentials", "Gmail refresh credentials", "Other users' private records", "Provider logs and backups", "Transient chat, captions and audio"] }, null, 2), {
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="careerup-data-${new Date().toISOString().slice(0, 10)}.json"` },
      });
    }

    // Recheck immediately before privileged work. The target is always the
    // verified cookie user's ID; no caller-provided account ID is accepted.
    const active = await session.supabase.rpc("careerup_session_valid");
    if (active.error || active.data !== true) throw new ScannerError("Your session expired. Sign in again.", 401);
    const disconnected = await disconnectGmail(session);
    const { data: tokens } = await session.supabase.auth.getSession();
    if (!tokens.session) throw new ScannerError("Your session expired. Sign in again.", 401);
    const signedOut = await admin.auth.admin.signOut(tokens.session.access_token, "global");
    if (signedOut.error) throw new ScannerError("Sessions could not be closed. Your account has not been deleted. Try again.", 503);
    // The Auth deletion trigger refunds open pools and clears the legacy calendar
    // FK in the same transaction as cascading account removal.
    const deleted = await admin.auth.admin.deleteUser(session.user.id);
    await session.supabase.auth.signOut({ scope: "local" });
    if (deleted.error) throw new ScannerError("You have been signed out, but deletion could not finish. Sign in again and retry or contact the project team.", 503);
    return NextResponse.json({ ok: true, message: "Your CareerUp account has been deleted.", googleRevocationWarning: disconnected.message.includes("could not be confirmed") }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ScannerError ? error.message : "The account request could not finish. Please try again." }, { status: error instanceof ScannerError ? error.status : 500, headers });
  }
}
