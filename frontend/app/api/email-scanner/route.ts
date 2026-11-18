import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSameOrigin, requireScannerUser, readScannerJson, ScannerError } from "@/lib/email-scanner/security";
import { autoSyncGmail, boardSyncState, setGmailAutomation, disconnectGmail, reviewUpdate, savePastedEmail, scanGmail, scannerAdmin, scannerState } from "@/lib/email-scanner/service";
import { GoogleAccessError } from "@/lib/email-scanner/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function failure(error: unknown) {
  if (error instanceof ScannerError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof GoogleAccessError) return NextResponse.json({ error: error.message }, { status: error.reconnect ? 403 : 503, headers });
  return NextResponse.json({ error: "The email request could not be completed. Try again or check the setup guide." }, { status: 503, headers });
}

export async function GET(request: Request) {
  try { const session = await requireScannerUser(); return NextResponse.json(new URL(request.url).searchParams.get("view") === "board" ? await boardSyncState(session) : await scannerState(session), { headers }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireScannerUser();
    const body = await readScannerJson(request);
    let result: { message: string };
    switch (body.action) {
      case "automation": result = await setGmailAutomation(session, body); break;
      case "auto-sync": result = await autoSyncGmail(session, body); break;
      case "paste": result = await savePastedEmail(session, body); break;
      case "scan": result = await scanGmail(session, body); break;
      case "confirm":
      case "create":
      case "dismiss": result = await reviewUpdate(session, body); break;
      case "disconnect": result = await disconnectGmail(session); break;
      case "clear": {
        if (body.confirm !== true) throw new ScannerError("Confirm deletion first.");
        const cleared = await scannerAdmin().from("email_updates").delete().eq("user_id", session.user.id);
        if (cleared.error) throw new ScannerError("Email records could not be deleted. Try again.", 503);
        result = { message: "Saved email records deleted. Application statuses were kept." };
        break;
      }
      default: throw new ScannerError("Unknown email scanner action.");
    }
    if (["confirm", "create", "scan", "auto-sync"].includes(String(body.action))) {
      for (const path of ["/applications", "/dashboard", "/calendar", "/profile"]) revalidatePath(path);
    }
    return NextResponse.json(result, { headers });
  } catch (error) { return failure(error); }
}
