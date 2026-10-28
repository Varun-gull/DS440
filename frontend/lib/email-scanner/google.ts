import "server-only";
import { scannerConfig } from "./config";

export class GoogleAccessError extends Error {
  constructor(public reconnect: boolean, public temporary = false) {
    super(reconnect ? "Gmail access expired or was revoked. Disconnect and connect again." : "Gmail could not complete the request. Try again later.");
  }
}

// Do not log Google response bodies: they can contain credentials or mail.
export async function googleTokenRequest(params: URLSearchParams) {
  const config = scannerConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...Object.fromEntries(params), client_id: config.clientId, client_secret: config.clientSecret }),
  });
  if (!response.ok) throw new GoogleAccessError(response.status === 400 || response.status === 401, response.status >= 500);
  const token = await response.json() as { access_token?: string; refresh_token?: string; scope?: string };
  if (!token.access_token) throw new GoogleAccessError(true);
  return token;
}

export async function gmailRequest<T>(accessToken: string, path: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new GoogleAccessError(response.status === 401 || response.status === 403, response.status === 429 || response.status >= 500);
  return await response.json() as T;
}

export async function revokeGoogleToken(token: string) {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }),
  });
  // 400 also represents an already invalid/revoked token.
  return response.ok || response.status === 400;
}
