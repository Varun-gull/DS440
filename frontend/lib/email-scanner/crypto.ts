import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function decodeKey(key: string) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(key) || Buffer.from(key, "base64").length !== 32) {
    throw new Error("EMAIL_SCANNER_ENCRYPTION_KEY must be a base64 encoded 32 byte key.");
  }
  return Buffer.from(key, "base64");
}

export function encryptToken(value: string, key: string, userId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", decodeKey(key), iv);
  cipher.setAAD(Buffer.from(`careerup:gmail:${userId}`));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(value: string, key: string, userId: string) {
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error("Invalid stored credential.");
  const decipher = createDecipheriv("aes-256-gcm", decodeKey(key), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`careerup:gmail:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
