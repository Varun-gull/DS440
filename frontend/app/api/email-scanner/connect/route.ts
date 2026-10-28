import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { GMAIL_SCOPE, OAUTH_COOKIE, scannerConfig } from "@/lib/email-scanner/config";
import { encryptToken } from "@/lib/email-scanner/crypto";
import { readScannerJson, requireSameOrigin, requireScannerUser, ScannerError } from "@/lib/email-scanner/security";
import { scannerAdmin } from "@/lib/email-scanner/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { user } = await requireScannerUser();
    const body = await readScannerJson(request);
    if (body.consent !== true) throw new ScannerError("Read and accept the Gmail scanner disclosure first.");
    const config = scannerConfig();
    if (!config.ready) throw new ScannerError("Finish the Google OAuth and encryption settings first.", 503);
    const existing = await scannerAdmin().from("email_connections").select("user_id").eq("user_id", user.id).maybeSingle();
    if (existing.error) throw new ScannerError("Apply the email scanner database migration first.", 503);
    if (existing.data) throw new ScannerError("Disconnect the current mailbox before connecting another one.", 409);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
      response_type: "code", scope: GMAIL_SCOPE, access_type: "offline", prompt: "consent select_account", state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    const response = NextResponse.json({ url: url.toString() }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(OAUTH_COOKIE, encryptToken(JSON.stringify({ state, verifier, userId: user.id, createdAt: Date.now() }), config.encryptionKey, "oauth"), {
      httpOnly: true, secure: config.baseUrl.startsWith("https:"), sameSite: "lax", path: "/api/email-scanner", maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof ScannerError ? error.message : "Gmail connection could not be started." },
      { status: error instanceof ScannerError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
