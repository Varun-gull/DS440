const baseUrl = process.env.CAREERUP_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "http://localhost:3000";
const syncUrl = new URL("/api/postings/sync", baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
const headers = {};

if (process.env.CRON_SECRET) {
  headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
}

const response = await fetch(syncUrl, { headers });
const body = await response.text();

if (!response.ok) {
  console.error(body);
  process.exit(1);
}

console.log(body);
