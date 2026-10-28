export function requiresMfaChallenge(currentLevel: string | null, nextLevel: string | null) {
  return currentLevel !== "aal2" && nextLevel === "aal2";
}

export function getSafeRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  return value;
}

export function normalizeOtpCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}
