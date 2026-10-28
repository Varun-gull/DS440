import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { scannerConfig } from "./config";

export class ScannerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function requireScannerUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new ScannerError("Connect Supabase and sign in to save email suggestions.", 503);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ScannerError("Sign in to use the email scanner.", 401);
  const { data, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaError || !data || requiresMfaChallenge(data.currentLevel, data.nextLevel)) {
    throw new ScannerError("Complete two factor authentication before accessing email settings.", 403);
  }
  return { supabase, user };
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = scannerConfig().baseUrl || new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ScannerError("Open CareerUp directly and try again.", 403);
  }
}

export async function readScannerJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ScannerError("Send a JSON request.", 415);
  // Enforce the actual bytes, not just a client supplied Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new ScannerError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 40000) { await reader.cancel(); throw new ScannerError("Email input is too large.", 413); }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new ScannerError("Invalid request body."); }
}
