import { NextResponse } from "next/server";
import { assistantConfig, assistantContext, assistantReadiness, assistantUser, AssistantError, generateAssistantReply } from "@/lib/assistant/server";
import { assistantJson, checkAssistantOrigin } from "@/lib/assistant/http";
import { offlineGuidance, validateMessages } from "@/lib/assistant/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof AssistantError ? error.message : "The AI provider could not complete this request. Check your quota or try the offline guide." },
    { status: error instanceof AssistantError ? error.status : 503, headers });
}
export async function GET() {
  try { return NextResponse.json(await assistantReadiness(await assistantUser()), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkAssistantOrigin(request);
    const session = await assistantUser();
    const body = await assistantJson(request);
    if (body.mode !== "ai" && body.mode !== "guide") throw new AssistantError("Choose AI chat or the offline guide.");
    if (body.mode === "ai" && body.consent !== true) throw new AssistantError("Approve sharing this conversation and selected context with Google first.");
    let messages;
    try { messages = validateMessages(body.messages); } catch (error) { throw new AssistantError((error as Error).message); }
    const context = await assistantContext(session, body);
    const text = body.mode === "guide" ? offlineGuidance(messages.at(-1)!.text, context) : await generateAssistantReply(session, messages, context);
    return NextResponse.json({ text, mode: body.mode, provider: body.mode === "ai" ? "Google Gemini" : "Offline rule based guide",
      model: body.mode === "ai" ? assistantConfig().model : null, fit: context.fit }, { headers });
  } catch (error) { return failure(error); }
}
