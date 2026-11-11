import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export class ProviderCapacityError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Database allocation coordinates warm/cold instances and both public sites.
// A process-local queue would not enforce the Google project's shared limit.
export async function waitForProviderSlot(model: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new ProviderCapacityError("AI capacity could not be checked. Try again shortly.", 503);
  const { data, error } = await admin.rpc("reserve_provider_slot", {
    p_bucket: `gemini:text:${model}`, p_spacing_ms: 4500,
  });
  if (error || !data || typeof data.allowed !== "boolean" || !Number.isFinite(data.waitMs)) {
    throw new ProviderCapacityError("AI capacity could not be checked. Your reward stays available. Try again shortly.", 503);
  }
  if (!data.allowed) throw new ProviderCapacityError("The AI queue is full. Please try again in two minutes. Your reward stays available.", 429);
  if (data.waitMs < 0 || data.waitMs > 126000) throw new ProviderCapacityError("AI capacity could not be checked. Try again shortly.", 503);
  await delay(data.waitMs);
}
