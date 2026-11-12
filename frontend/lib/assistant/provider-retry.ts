// Read only retry metadata. Never return or log raw provider messages.
export function providerRetryDelay(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error) || Number(error.status) !== 429) return null;
  let details: { retryDelay?: unknown; violations?: { quotaId?: string }[] }[] = [];
  if ("message" in error && typeof error.message === "string" && error.message.length < 30000) {
    try { const body = JSON.parse(error.message); details = body.error?.details ?? body.details ?? []; } catch { /* Some provider errors omit structured metadata. */ }
  }
  if (!Array.isArray(details)) return 5000;
  if (details.some(d => Array.isArray(d?.violations) && d.violations.some(v => /perday/i.test(v?.quotaId ?? "")))) return null;
  const retry = details.find(d => typeof d?.retryDelay === "string")?.retryDelay;
  if (typeof retry === "string" && /^\d+(?:\.\d+)?s$/.test(retry)) {
    const ms = Math.ceil(Number(retry.slice(0, -1)) * 1000);
    return ms > 60000 ? null : Math.max(5000, ms);
  }
  return 5000;
}

export async function queuedProviderRequest<T>(options: {
  reserveSlot: (remainingWaitMs: number) => Promise<void>;
  validateSession: () => Promise<void>;
  request: () => Promise<T>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  jitter: () => number;
  requestTimeoutMs: number;
}) {
  const deadline = options.now() + 205000;
  for (let attempt = 0; ; attempt++) {
    await options.reserveSlot(Math.max(0, Math.min(126000, deadline - options.now() - options.requestTimeoutMs)));
    await options.validateSession();
    try { return await options.request(); }
    catch (error) {
      const retryMs = providerRetryDelay(error);
      if (attempt >= 1 || retryMs === null || options.now() + retryMs + 1000 + options.requestTimeoutMs >= deadline) throw error;
      await options.sleep(retryMs + Math.floor(Math.max(0, Math.min(1, options.jitter())) * 999));
    }
  }
}
