import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { getFitScoreBreakdown } from "@/lib/fit-score";
import { buildAssistantInstructions, redactResumeContact, VOICE_SECONDS, type AssistantContext, type AssistantJob, type ChatMessage } from "./core";

export class AssistantError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function assistantUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new AssistantError("Sign in with Supabase to use the career assistant.", 503);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AssistantError("Sign in to use the career assistant.", 401);
  const { data, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaError || !data || requiresMfaChallenge(data.currentLevel, data.nextLevel)) throw new AssistantError("Complete two factor authentication first.", 403);
  return { supabase, user };
}
type Session = Awaited<ReturnType<typeof assistantUser>>;

export function assistantConfig() {
  return { configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model: process.env.CAREERUP_CHAT_MODEL || "gemini-3.5-flash-lite",
    voiceModel: process.env.CAREERUP_VOICE_MODEL || "gemini-3.8-live",
    voiceEnabled: process.env.CAREERUP_VOICE_ENABLED === "true" };
}

export async function assistantContext(session: Session, body: Record<string, unknown>): Promise<AssistantContext> {
  const { data, error } = await session.supabase.from("profiles").select(body.includeResume === true ? "target_roles,resume_text" : "target_roles").eq("id", session.user.id).maybeSingle();
  if (error) throw new AssistantError("Your career context could not be loaded.", 503);
  const profile = data as { target_roles?: string[]; resume_text?: string } | null;
  const resumeText = body.includeResume === true ? redactResumeContact(profile?.resume_text ?? "") : "";
  let job: AssistantJob | null = null;
  if (typeof body.postingId === "string" && body.postingId) {
    if (!/^[0-9a-f-]{36}$/i.test(body.postingId)) throw new AssistantError("Select a valid job.");
    const result = await session.supabase.from("postings").select("id,company,title,location,description,tags").eq("id", body.postingId).maybeSingle();
    if (result.error || !result.data) throw new AssistantError("That cached posting is unavailable. Paste the description instead.");
    job = { ...result.data, description: result.data.description.slice(0, 8000), tags: (result.data.tags ?? []).slice(0, 20) };
  } else if (typeof body.jobDescription === "string" && body.jobDescription.trim()) {
    if (body.jobDescription.length > 8000 || typeof body.jobTitle !== "string" || body.jobTitle.length > 160) throw new AssistantError("Use a job title up to 160 characters and a description up to 8,000 characters.");
    job = { company: "Provided by student", title: body.jobTitle.trim() || "Selected role", location: "Not specified", description: body.jobDescription.trim(), tags: [] };
  }
  const fit = job && resumeText ? getFitScoreBreakdown(job, { resumeText, resumeKeywords: [], targetRoles: [], targetLocations: [] }) : null;
  return { targetRoles: (profile?.target_roles ?? []).slice(0, 5), resumeText, job, fit };
}

export async function assistantReadiness(session: Session) {
  const config = assistantConfig();
  const admin = getSupabaseAdminClient();
  let quotaReady = false;
  let usage: { text_requests: number; voice_sessions: number; voice_until: string | null } | null = null;
  if (admin) {
    const result = await admin.from("assistant_usage").select("text_requests,voice_sessions,voice_until").eq("user_id", session.user.id).eq("usage_day", new Date().toISOString().slice(0, 10)).maybeSingle();
    quotaReady = !result.error; usage = result.data;
  }
  const jobs = await session.supabase.from("postings").select("id,company,title,location").order("last_seen_at", { ascending: false }).limit(50);
  return { configured: config.configured, quotaReady, aiReady: config.configured && quotaReady,
    voiceReady: config.configured && quotaReady && config.voiceEnabled,
    model: config.model, voiceModel: config.voiceModel,
    textRemaining: Math.max(0, 50 - (usage?.text_requests ?? 0)), voiceRemaining: Math.max(0, 3 - (usage?.voice_sessions ?? 0)),
    voiceAvailableAt: usage?.voice_until ?? null, jobs: jobs.data ?? [] };
}

async function reserve(session: Session, mode: "text" | "voice") {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new AssistantError("Assistant server configuration is incomplete.", 503);
  const result = await admin.rpc("reserve_assistant_usage", { p_user_id: session.user.id, p_mode: mode });
  if (result.error) throw new AssistantError("Assistant usage limits are not configured. Apply career-assistant.sql.", 503);
  if (!result.data) throw new AssistantError(mode === "voice" ? "Voice session limit reached or another session is still reserved. Try later." : "Message limit reached. Wait briefly or return after the UTC daily reset.", 429);
}

function googleClient() {
  if (!assistantConfig().configured) throw new AssistantError("The AI provider is not configured. You can use the offline guide instead.", 503);
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta", timeout: 25000 } });
}

export async function generateAssistantReply(session: Session, messages: ChatMessage[], context: AssistantContext) {
  const ai = googleClient();
  await reserve(session, "text");
  const result = await ai.models.generateContent({ model: assistantConfig().model,
    contents: messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.text }] })),
    config: { systemInstruction: buildAssistantInstructions(context), maxOutputTokens: 700, temperature: 0.4 },
  });
  const text = result.text?.trim();
  if (!text) throw new AssistantError("The model did not return a usable response. Try rephrasing your question.", 502);
  return text.slice(0, 10000);
}

export async function createVoiceToken(session: Session, context: AssistantContext) {
  const config = assistantConfig();
  if (!config.voiceEnabled) throw new AssistantError("Live voice is not enabled by the project owner.", 503);
  const ai = googleClient();
  await reserve(session, "voice");
  const expiresAt = new Date(Date.now() + VOICE_SECONDS * 1000).toISOString();
  const liveConfig = { responseModalities: [Modality.AUDIO], maxOutputTokens: 256,
    systemInstruction: buildAssistantInstructions(context, true), inputAudioTranscription: {}, outputAudioTranscription: {},
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } };
  const result = await ai.authTokens.create({ config: { uses: 1, expireTime: expiresAt,
    newSessionExpireTime: new Date(Date.now() + 60000).toISOString(), liveConnectConstraints: { model: config.voiceModel, config: liveConfig } } });
  if (!result.name) throw new AssistantError("A voice session could not be created.", 502);
  // Only this single use, five minute token is returned. The permanent key and
  // selected resume context stay on the trusted server/provider boundary.
  return { token: result.name, model: config.voiceModel, expiresAt, durationSeconds: VOICE_SECONDS };
}
