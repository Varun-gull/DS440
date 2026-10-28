import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GMAIL_SCOPE, OAUTH_COOKIE, scannerConfig } from "@/lib/email-scanner/config";
import { decryptToken, encryptToken } from "@/lib/email-scanner/crypto";
import { gmailRequest, googleTokenRequest, revokeGoogleToken } from "@/lib/email-scanner/google";
import { requireScannerUser, ScannerError } from "@/lib/email-scanner/security";
import { scannerAdmin } from "@/lib/email-scanner/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = scannerConfig();
  const destination = new URL("/applications/email-scanner", config.baseUrl || new URL(request.url).origin);
  try {
    if (!config.ready) throw new ScannerError("Gmail setup is incomplete.");
    const { user } = await requireScannerUser();
    const query = new URL(request.url).searchParams;
    const cookie = await (await cookies()).get(OAUTH_COOKIE)?.value;
    if (!cookie) throw new ScannerError("The connection request expired. Start again.");
    const saved = JSON.parse(decryptToken(cookie, config.encryptionKey, "oauth")) as { state: string; verifier: string; userId: string; createdAt: number };
    const state = query.get("state") ?? "";
    if (!saved.state || state.length !== saved.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))
      || saved.userId !== user.id || !Number.isFinite(saved.createdAt) || Date.now() - saved.createdAt > 600000 || saved.createdAt > Date.now()) {
      throw new ScannerError("The connection could not be verified. Start again.");
    }
    if (query.has("error")) throw new ScannerError("Gmail permission was not granted. Nothing was connected.");
    const code = query.get("code");
    if (!code || code.length > 4096) throw new ScannerError("Google did not return a valid connection code.");
    const tokens = await googleTokenRequest(new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: config.redirectUri, code_verifier: saved.verifier }));
    const scopes = tokens.scope?.split(" ") ?? [];
    const excessiveMailAccess = scopes.some((scope) => scope === "https://mail.google.com/" || (scope.includes("/auth/gmail.") && scope !== GMAIL_SCOPE));
    if (!tokens.refresh_token || !scopes.includes(GMAIL_SCOPE) || excessiveMailAccess) {
      await revokeGoogleToken(tokens.refresh_token ?? tokens.access_token!).catch(() => false);
      throw new ScannerError("Read permission and offline access are required. Connect again and approve Gmail reading.");
    }
    try {
      const profile = await gmailRequest<{ emailAddress?: string }>(tokens.access_token!, "profile");
      if (!profile.emailAddress) throw new Error();
      // Insert rather than upsert: concurrent callbacks cannot replace a mailbox.
      const savedConnection = await scannerAdmin().from("email_connections").insert({ user_id: user.id,
        email: profile.emailAddress.slice(0, 320), refresh_token_encrypted: encryptToken(tokens.refresh_token, config.encryptionKey, user.id),
        granted_scope: tokens.scope, consented_at: new Date().toISOString() });
      if (savedConnection.error) throw new ScannerError("A mailbox may already be connected. Refresh the scanner before retrying.");
    } catch (error) {
      await revokeGoogleToken(tokens.refresh_token).catch(() => false);
      throw error;
    }
    destination.searchParams.set("notice", "connected");
  } catch (error) {
    // Never copy Google errors, authorization codes, or tokens to URLs or logs.
    destination.searchParams.set("message", error instanceof ScannerError ? error.message : "Gmail connection failed. Check the setup guide and try again.");
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, secure: config.baseUrl.startsWith("https:"), sameSite: "lax", path: "/api/email-scanner", maxAge: 0 });
  return response;
}
