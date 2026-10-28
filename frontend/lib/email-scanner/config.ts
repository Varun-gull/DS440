import "server-only";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const OAUTH_COOKIE = "careerup_gmail_oauth";

export function scannerConfig() {
  const values = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    EMAIL_SCANNER_BASE_URL: process.env.EMAIL_SCANNER_BASE_URL,
    EMAIL_SCANNER_ENCRYPTION_KEY: process.env.EMAIL_SCANNER_ENCRYPTION_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const missing = Object.entries(values).filter(([, value]) => !value?.trim()).map(([name]) => name);
  let baseUrl = "";
  try {
    const url = new URL(values.EMAIL_SCANNER_BASE_URL ?? "");
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    baseUrl = url.origin;
  } catch {
    if (!missing.includes("EMAIL_SCANNER_BASE_URL")) missing.push("EMAIL_SCANNER_BASE_URL");
  }
  if (values.EMAIL_SCANNER_ENCRYPTION_KEY && !/^[A-Za-z0-9+/]{43}=$/.test(values.EMAIL_SCANNER_ENCRYPTION_KEY)) {
    missing.push("EMAIL_SCANNER_ENCRYPTION_KEY");
  }
  return { missing, ready: !missing.length, baseUrl,
    clientId: values.GOOGLE_CLIENT_ID ?? "", clientSecret: values.GOOGLE_CLIENT_SECRET ?? "",
    encryptionKey: values.EMAIL_SCANNER_ENCRYPTION_KEY ?? "",
    redirectUri: `${baseUrl}/api/email-scanner/callback` };
}
