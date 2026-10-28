import { AssistantError } from "./server";

export function checkAssistantOrigin(request: Request) {
  const expected = process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).origin : new URL(request.url).origin;
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new AssistantError("Open CareerUp directly and try again.", 403);
}

export async function assistantJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AssistantError("A JSON request is required.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AssistantError("A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 40000) { await reader.cancel(); throw new AssistantError("The request is too large. Shorten the conversation or job description.", 413); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new AssistantError("Invalid request body."); }
}
