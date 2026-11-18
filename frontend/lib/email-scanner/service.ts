import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { scannerConfig } from "./config";
import { decryptToken } from "./crypto";
import { analyzeEmail, EMAIL_PARSER_VERSION } from "./scanner";
import { decodeGmailMessage, isIncomingGmailMessage, type GmailMessage } from "./gmail-message";
import { gmailRequest, googleTokenRequest, GoogleAccessError, revokeGoogleToken } from "./google";
import { ScannerError, requireScannerUser } from "./security";
import { resolveScanWindow, gmailSearchQuery, emailWithinWindow } from "./window";
import type { EmailInput, EmailUpdate, ScannerState, TrackedApplication } from "./types";

type Session = Awaited<ReturnType<typeof requireScannerUser>>;
type Connection = {
  user_id: string; email: string; refresh_token_encrypted: string;
  last_scanned_at: string | null; scan_page_token: string | null; scan_query: string | null;
  scan_days: number; reconnect_required: boolean; scan_parser_version: number;
  scan_mode: string; scan_start_date: string | null; scan_end_date: string | null; scan_checked: number; scan_completed_at: string | null;
};
const updateColumns = "id,source,subject,sender,received_at,proposed_status,evidence,extracted_company,extracted_role,action_date_text,confidence,suggested_application_id,application_id,previous_status,decision,reviewed_at,created_at,automation_note,automatically_applied,recruiting_cycle_year";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export function scannerAdmin() {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new ScannerError("The server needs a Supabase service role key before saving email suggestions.", 503);
  return admin;
}
function databaseError() { return new ScannerError("Email storage is unavailable. Apply supabase/email-scanner.sql and check the server settings.", 503); }

export async function scannerApplications(session: Session) {
  const { data, error } = await session.supabase.from("applications")
    .select("id,company,role,status,updated_at,application_year").eq("user_id", session.user.id)
    .order("updated_at", { ascending: false }).limit(2000);
  if (error) throw new ScannerError("Your applications could not be loaded. Try again.", 503);
  return (data ?? []) as TrackedApplication[];
}

export async function scannerState(session: Session): Promise<ScannerState> {
  const config = scannerConfig();
  const applications = await scannerApplications(session);
  const base = { signedIn: true, gmailReady: config.ready, missingSettings: config.missing, applications };
  const admin = getSupabaseAdminClient();
  if (!admin) return { ...base, databaseReady: false, connection: null, updates: [], error: "Email storage needs server configuration. You can still preview pasted email locally." };
  // Thirty day retention, including evidence excerpts. This also removes raw
  // subject/sender fields after the same period; application statuses remain.
  const expired = await admin.from("email_updates").delete().eq("user_id", session.user.id)
    .lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
  if (expired.error) return { ...base, databaseReady: false, connection: null, updates: [], error: databaseError().message };
  const [connected, pending, history] = await Promise.all([
    admin.from("email_connections").select("email,last_scanned_at,scan_page_token,scan_days,reconnect_required,auto_sync_enabled,scan_mode,scan_start_date,scan_end_date,scan_checked,scan_completed_at").eq("user_id", session.user.id).maybeSingle(),
    session.supabase.from("email_updates").select(updateColumns).eq("user_id", session.user.id).eq("decision", "pending").order("received_at", { ascending: false }).limit(80),
    session.supabase.from("email_updates").select(updateColumns).eq("user_id", session.user.id).neq("decision", "pending").order("reviewed_at", { ascending: false }).limit(20),
  ]);
  if (connected.error || pending.error || history.error) throw databaseError();
  const c = connected.data;
  const window = c ? resolveScanWindow({}, c) : null;
  return { ...base, databaseReady: true, connection: c ? {
    email: c.email, lastScannedAt: c.last_scanned_at, hasMore: Boolean(c.scan_page_token),
    scanDays: c.scan_days, reconnectRequired: c.reconnect_required, autoSyncEnabled: c.auto_sync_enabled,
    mode: window!.mode, startDate: window!.startDate, endDate: window!.endDate, cycleYear: window!.cycleYear,
    checked: c.scan_checked, completedAt: c.scan_completed_at,
  } : null, updates: [...(pending.data ?? []), ...(history.data ?? [])] as EmailUpdate[] };
}

function suggestion(email: EmailInput, applications: TrackedApplication[]) {
  const result = analyzeEmail(email, applications);
  if (!result.status) return null;
  return { subject: email.subject.slice(0, 300), sender: email.sender.slice(0, 300), received_at: email.receivedAt,
    proposed_status: result.status, evidence: result.evidence, extracted_company: result.company,
    extracted_role: result.role, action_date_text: result.actionDateText, confidence: result.confidence,
    suggested_application_id: result.suggestedApplicationId, identity_complete: result.identityComplete, parser_version: EMAIL_PARSER_VERSION };
}

export async function boardSyncState(session: Session) {
  const { data, error } = await scannerAdmin().from("email_connections")
    .select("auto_sync_enabled,reconnect_required,last_scanned_at,scan_page_token,scan_days,scan_parser_version,scan_mode,scan_start_date,scan_end_date,scan_checked,scan_completed_at").eq("user_id", session.user.id).maybeSingle();
  if (error) throw databaseError();
  const window = resolveScanWindow({}, data ?? {});
  return { ...window, checked: data?.scan_checked ?? 0, completedAt: data?.scan_completed_at ?? null,
    connected: Boolean(data), enabled: data?.auto_sync_enabled ?? false, reconnectRequired: data?.reconnect_required ?? false,
    lastScannedAt: data?.last_scanned_at ?? null, hasMore: Boolean(data?.scan_page_token), days: data?.scan_days ?? 30,
    parserOutdated: (data?.scan_parser_version ?? 1) < EMAIL_PARSER_VERSION || (data?.scan_mode === "cycle" && data.scan_start_date !== window.startDate) };
}

async function pendingGmailCount(session: Session) {
  const { count, error } = await session.supabase.from("email_updates").select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id).eq("source", "gmail").eq("decision", "pending");
  if (error) throw databaseError();
  return count ?? 0;
}

export async function setGmailAutomation(session: Session, body: Record<string, unknown>) {
  if (typeof body.enabled !== "boolean" || (body.enabled && body.consent !== true)) throw new ScannerError("Approve automatic board changes before enabling Gmail sync.");
  const { data, error } = await scannerAdmin().from("email_connections").update({ auto_sync_enabled: body.enabled,
    auto_sync_consented_at: body.enabled ? new Date().toISOString() : null }).eq("user_id", session.user.id).select("user_id");
  if (error) throw databaseError();
  if (!data?.length) throw new ScannerError("Connect Gmail before enabling automatic sync.");
  return { message: body.enabled ? "Automatic Gmail sync enabled. Open your application board to start. Clear emails can add and update applications; uncertain matches stay for review." : "Automatic Gmail sync disabled. You can still scan and review emails manually." };
}

export async function autoSyncGmail(session: Session, body: Record<string, unknown> = {}) {
  const state = await boardSyncState(session);
  if (!state.connected || !state.enabled) throw new ScannerError("Enable automatic Gmail sync in the email scanner first.", 409);
  if (body.force !== true && !state.parserOutdated && !state.hasMore && state.lastScannedAt && Date.now() - Date.parse(state.lastScannedAt) < 300000) {
    const pending = await session.supabase.rpc("apply_gmail_board_updates");
    if (pending.error) throw new ScannerError("Saved email updates could not be applied. Retry sync.", 503);
    const review = await pendingGmailCount(session);
    return { ...pending.data, review, message: review ? `Last scan is current. ${review} email${review === 1 ? " needs" : "s need"} review before changing the board.` : "Last scan is current. No emails are waiting for review.", hasMore: false };
  }
  return scanGmail(session, { mode: state.mode, days: state.days, startDate: state.startDate, endDate: state.endDate,
    continue: state.hasMore && !state.parserOutdated, force: body.force === true });
}

export async function savePastedEmail(session: Session, body: Record<string, unknown>) {
  if (body.consent !== true) throw new ScannerError("Confirm permission to process this email first.");
  const string = (key: string, max: number) => typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";
  const date = string("receivedAt", 50);
  if (date && !Number.isFinite(Date.parse(date))) throw new ScannerError("Choose a valid received date.");
  const email: EmailInput = { subject: string("subject", 300), sender: string("sender", 300), body: string("body", 24000), receivedAt: date ? new Date(date).toISOString() : new Date().toISOString() };
  if (!email.body || !email.subject) throw new ScannerError("Add the subject and message text.");
  const row = suggestion(email, await scannerApplications(session));
  if (!row) throw new ScannerError(analyzeEmail(email).explanation);
  const admin = scannerAdmin();
  const { count, error } = await admin.from("email_updates").select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id).eq("source", "paste").gte("created_at", new Date(Date.now() - 300000).toISOString());
  if (error) throw databaseError();
  if ((count ?? 0) >= 20) throw new ScannerError("Please wait a few minutes before saving more pasted emails.", 429);
  const saved = await admin.from("email_updates").upsert({ ...row, user_id: session.user.id, source: "paste",
    source_key: hash(`${email.subject.trim()}\n${email.sender.trim()}\n${email.body.trim()}`) },
  { onConflict: "user_id,source,source_key", ignoreDuplicates: true }).select("id");
  if (saved.error) throw databaseError();
  return { message: saved.data?.length ? "Suggestion saved for review. Your application has not changed." : "This email already has a saved suggestion." };
}

export async function scanGmail(session: Session, body: Record<string, unknown>) {
  const config = scannerConfig();
  if (!config.ready) throw new ScannerError("Finish the Gmail server settings before scanning.", 503);
  const admin = scannerAdmin();
  const { data: connection, error } = await admin.from("email_connections").select("*").eq("user_id", session.user.id).maybeSingle<Connection>();
  if (error) throw databaseError();
  if (!connection) throw new ScannerError("Connect Gmail first.");
  if (connection.reconnect_required) throw new ScannerError("Disconnect and reconnect Gmail before scanning.");
  let window;
  try { window = resolveScanWindow(body, connection); }
  catch (error) { throw new ScannerError(error instanceof Error ? error.message : "Choose a valid search window."); }
  const { data: lease, error: lockError } = await admin.rpc("claim_email_scan", { p_user_id: session.user.id });
  if (lockError) throw databaseError();
  if (!lease) throw new ScannerError("A scan is running or just finished. Wait 20 seconds and try again.", 429);
  try {
    const leased = await admin.from("email_connections").select("*").eq("user_id", session.user.id).eq("scan_lease", lease).maybeSingle<Connection>();
    if (leased.error || !leased.data) throw new ScannerError("The mailbox changed. Refresh before scanning.", 409);
    const current = leased.data;
    const token = await googleTokenRequest(new URLSearchParams({ grant_type: "refresh_token",
      refresh_token: decryptToken(current.refresh_token_encrypted, config.encryptionKey, session.user.id) }));
    const access = token.access_token!;
    const continuing = body.continue === true && current.scan_parser_version >= EMAIL_PARSER_VERSION && current.scan_page_token && current.scan_query
      && current.scan_mode === window.mode && current.scan_start_date === window.startDate && current.scan_end_date === window.endDate;
    const query = continuing ? current.scan_query! : gmailSearchQuery(window);
    const params = new URLSearchParams({ q: query, maxResults: "20", fields: "messages(id,threadId),nextPageToken" });
    if (continuing) params.set("pageToken", current.scan_page_token!);
    const page = await gmailRequest<{ messages?: Array<{ id: string; threadId: string }>; nextPageToken?: string }>(access, `messages?${params}`);
    const messages = page.messages ?? [];
    const keys = messages.map((message) => hash(`${current.email.toLowerCase()}:${message.id}`));
    const existing = keys.length ? await admin.from("email_updates").select("source_key,decision,parser_version").eq("user_id", session.user.id).eq("source", "gmail").in("source_key", keys) : { data: [], error: null };
    if (existing.error) throw databaseError();
    // Revisit pending records after a parser upgrade, and when the user explicitly
    // syncs. Reviewed records are immutable; old uncertain matches are not lost.
    const seen = new Set((existing.data ?? []).filter(row => row.decision !== "pending"
      || (row.parser_version >= EMAIL_PARSER_VERSION && body.force !== true)).map(row => row.source_key));
    const applications = (await scannerApplications(session)).filter(app => window.mode === "recent" || app.application_year === window.cycleYear);
    const rows: Array<Record<string, unknown>> = [];
    const remaining = messages.filter((_, index) => !seen.has(keys[index]));
    for (let start = 0; start < remaining.length; start += 5) {
      const batch = await Promise.all(remaining.slice(start, start + 5).map(async (message) => {
        const full = await gmailRequest<GmailMessage>(access, `messages/${encodeURIComponent(message.id)}?format=full&fields=id,threadId,internalDate,labelIds,payload`);
        if (!isIncomingGmailMessage(full, current.email)) return null;
        const email = decodeGmailMessage(full);
        if (!emailWithinWindow(email.receivedAt, window)) return null;
        const result = suggestion(email, applications);
        return result ? { ...result, recruiting_cycle_year: window.mode === "recent" ? null : window.cycleYear, source_key: hash(`${current.email.toLowerCase()}:${full.id}`),
          thread_key: hash(`${current.email.toLowerCase()}:${full.threadId}`) } : null;
      }));
      for (const row of batch) if (row) rows.push(row);
    }
    const saved = await admin.rpc("save_gmail_cycle_batch", { p_user_id: session.user.id, p_lease: lease,
      p_updates: rows, p_next_page: page.nextPageToken ?? null, p_query: query, p_days: window.days,
      p_mode: window.mode, p_start_date: window.startDate, p_end_date: window.endDate, p_cycle_year: window.cycleYear,
      p_parser_version: EMAIL_PARSER_VERSION, p_checked: messages.length, p_restart: !continuing });
    if (saved.error) throw new ScannerError("The scan could not be saved. Retry this batch; no checkpoint was advanced.", 409);
    const applied = await session.supabase.rpc("apply_gmail_board_updates");
    if (applied.error) throw new ScannerError("Emails were saved, but board sync could not finish. Retry sync to apply saved updates.", 503);
    const counts = { ...(applied.data as { added: number; updated: number }), review: await pendingGmailCount(session) };
    const checked = (continuing ? current.scan_checked : 0) + messages.length;
    return { message: `Checked ${checked} emails from ${window.startDate} through ${window.endDate}. This batch added ${counts.added} application${counts.added === 1 ? "" : "s"} and updated ${counts.updated}. ${counts.review} email${counts.review === 1 ? " needs" : "s need"} review. ${page.nextPageToken ? "Older emails remain; backfill will continue while this page is open." : "Backfill complete for this date range."}`,
      ...counts, checked, ...window, hasMore: Boolean(page.nextPageToken) };
  } catch (error) {
    if (error instanceof GoogleAccessError && error.reconnect) {
      await admin.from("email_connections").update({ reconnect_required: true }).eq("user_id", session.user.id).eq("scan_lease", lease);
    }
    throw error;
  } finally {
    await admin.from("email_connections").update({ scan_lease: null, scan_lease_until: null }).eq("user_id", session.user.id).eq("scan_lease", lease);
  }
}

export async function disconnectGmail(session: Session) {
  const admin = scannerAdmin();
  const loaded = await admin.from("email_connections").select("refresh_token_encrypted").eq("user_id", session.user.id).maybeSingle();
  if (loaded.error) throw databaseError();
  let revoked = !loaded.data;
  if (loaded.data) {
    try { revoked = await revokeGoogleToken(decryptToken(loaded.data.refresh_token_encrypted, scannerConfig().encryptionKey, session.user.id)); }
    catch { revoked = false; }
  }
  const deleted = await admin.rpc("disconnect_email_scanner", { p_user_id: session.user.id });
  if (deleted.error) throw databaseError();
  return { message: revoked ? "Gmail disconnected and imported Gmail records deleted. Application changes were kept."
    : "Local Gmail credentials and imported records deleted. Also revoke CareerUp in your Google account connections because Google revocation could not be confirmed." };
}

export async function reviewUpdate(session: Session, body: Record<string, unknown>) {
  const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (!uuid(body.updateId)) throw new ScannerError("Choose a valid suggestion.");
  if (body.action === "create") {
    if (typeof body.company !== "string" || typeof body.role !== "string" || body.company.trim().length < 2
      || body.company.length > 70 || body.role.trim().length < 3 || body.role.length > 160 || !Number.isInteger(body.cycleYear)) {
      throw new ScannerError("Enter the company, job title and recruiting cycle year from the email.");
    }
    const created = await session.supabase.rpc("create_email_application", { p_update_id: body.updateId,
      p_company: body.company.trim(), p_role: body.role.trim(), p_year: body.cycleYear });
    if (created.error) throw new ScannerError(/already|not found|date|valid cycle/.test(created.error.message) ? created.error.message : "The card could not be created. Refresh and try again.", 409);
    return { message: "Application added to your recruiting-cycle board. No points were awarded for importing email." };
  }
  if (body.action === "dismiss") {
    const result = await scannerAdmin().from("email_updates").update({ decision: "dismissed", reviewed_at: new Date().toISOString() })
      .eq("user_id", session.user.id).eq("id", body.updateId as string).eq("decision", "pending").select("id");
    if (result.error) throw databaseError();
    if (!result.data?.length) throw new ScannerError("This suggestion changed. Refresh and try again.", 409);
    return { message: "Suggestion dismissed. Your application has not changed." };
  }
  if (!uuid(body.applicationId) || typeof body.expectedStatus !== "string" || typeof body.expectedUpdatedAt !== "string"
    || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) throw new ScannerError("Choose an application and refresh its current status.");
  const result = await session.supabase.rpc("confirm_email_update", { p_update_id: body.updateId, p_application_id: body.applicationId,
    p_expected_status: body.expectedStatus, p_expected_updated_at: body.expectedUpdatedAt, p_acknowledge_older: body.acknowledgeOlder === true });
  if (result.error) {
    const safe = ["application changed", "already been reviewed", "predates", "not found", "two factor"].some((part) => result.error.message.toLowerCase().includes(part));
    throw new ScannerError(safe ? result.error.message : "The update could not be confirmed. Refresh and try again.", 409);
  }
  return { message: "Application status updated. No XP or streak credit was added for scanning email." };
}
