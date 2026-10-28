import type { EmailInput } from "./types.ts";

type Part = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  headers?: Array<{ name: string; value: string }>;
  parts?: Part[];
};
export type GmailMessage = { id: string; threadId: string; internalDate?: string; payload?: Part };

function textParts(part: Part, wanted: string, depth = 0): string[] {
  if (depth > 10 || part.filename) return [];
  if (part.mimeType === wanted && part.body?.data) {
    // Gmail body.data is already the decoded MIME content, encoded as base64url.
    return [Buffer.from(part.body.data.slice(0, 128000), "base64url").toString("utf8")];
  }
  return (part.parts ?? []).slice(0, 30).flatMap((child) => textParts(child, wanted, depth + 1));
}

export function decodeGmailMessage(message: GmailMessage): EmailInput {
  const headers = message.payload?.headers ?? [];
  const header = (name: string) => headers.find((item) => item.name.toLowerCase() === name)?.value ?? "";
  const plain = message.payload ? textParts(message.payload, "text/plain") : [];
  const html = message.payload && !plain.length ? textParts(message.payload, "text/html") : [];
  const stamp = Number(message.internalDate);
  if (!Number.isFinite(stamp) || stamp <= 0) throw new Error("Message has no valid received date.");
  return {
    subject: header("subject").slice(0, 300),
    sender: header("from").slice(0, 300),
    // Preserve quote containers until the classifier removes old replies.
    body: (plain.length ? plain : html).join("\n").slice(0, 24000),
    receivedAt: new Date(stamp).toISOString(),
  };
}
