import { NextResponse } from "next/server";
import { assistantContext, assistantUser, AssistantError, createVoiceToken, leaveVoiceTurn } from "@/lib/assistant/server";
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
    if (body.requestId != null && (typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId))) throw new AssistantError("Invalid voice request.");
    if (body.action === "leave") {
      if (typeof body.requestId !== "string") throw new AssistantError("Choose a voice request to release.");
      await leaveVoiceTurn(session, body.requestId);
      return NextResponse.json({ ok: true }, { headers });
    }
    if (body.consent !== true) throw new AssistantError("Approve Google processing your voice and selected career context before starting.");
    const result = await createVoiceToken(session, () => assistantContext(session, body), typeof body.requestId === "string" ? body.requestId : crypto.randomUUID());
    return NextResponse.json(result, { status: result.queued ? 202 : 200, headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AssistantError ? error.message : "The voice provider could not create a session. Check provider access and quota." },
      { status: error instanceof AssistantError ? error.status : 503, headers });
  }
}
