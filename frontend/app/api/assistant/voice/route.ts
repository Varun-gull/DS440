import { NextResponse } from "next/server";
import { assistantContext, assistantUser, AssistantError, createVoiceToken } from "@/lib/assistant/server";
import { assistantJson, checkAssistantOrigin } from "@/lib/assistant/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    checkAssistantOrigin(request);
    const session = await assistantUser();
    const body = await assistantJson(request);
    if (body.consent !== true) throw new AssistantError("Approve Google processing your voice and selected career context before starting.");
    return NextResponse.json(await createVoiceToken(session, await assistantContext(session, body)), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AssistantError ? error.message : "The voice provider could not create a session. Check provider access and quota." },
      { status: error instanceof AssistantError ? error.status : 503, headers });
  }
}
