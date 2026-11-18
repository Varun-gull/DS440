// Recruiting cycles begin July 1. Dates are calendar days in America/New_York.
export type ScanWindow = { mode: "cycle" | "custom" | "recent"; startDate: string; endDate: string; cycleYear: number; days: number };
type SavedWindow = { scan_mode?: string; scan_start_date?: string | null; scan_end_date?: string | null; scan_days?: number };
export function calendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function currentRecruitingCycle(now = new Date()) {
  const endDate = calendarDate(now), year = Number(endDate.slice(0, 4)) - (endDate.slice(5) < "07-01" ? 1 : 0);
  return { startDate: `${year}-07-01`, endDate, cycleYear: year };
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function resolveScanWindow(input: Record<string, unknown>, saved: SavedWindow = {}, now = new Date()): ScanWindow {
  const cycle = currentRecruitingCycle(now);
  const mode = input.mode ?? (input.days !== undefined ? "recent" : saved.scan_mode ?? "cycle");
  if (mode === "cycle") return { mode, ...cycle, days: 30 };
  if (mode === "recent") {
    const days = Number(input.days ?? saved.scan_days ?? 30);
    if (![7, 30, 90].includes(days)) throw new Error("Choose 7, 30, or 90 days.");
    return { mode, days, startDate: calendarDate(new Date(now.getTime() - days * 86400000)), endDate: cycle.endDate, cycleYear: cycle.cycleYear };
  }
  if (mode !== "custom") throw new Error("Choose the current recruiting cycle or a custom date range.");
  const startDate = input.startDate ?? saved.scan_start_date, endDate = input.endDate ?? saved.scan_end_date;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || endDate > cycle.endDate
    || Date.parse(endDate) - Date.parse(startDate) > 731 * 86400000) throw new Error("Choose valid dates, up to two years apart, ending no later than today.");
  return { mode, startDate, endDate, days: 30, cycleYear: Number(startDate.slice(0, 4)) - (startDate.slice(5) < "07-01" ? 1 : 0) };
}
export function emailWithinWindow(receivedAt: string, window: ScanWindow) {
  if (!Number.isFinite(Date.parse(receivedAt))) return false;
  const date = calendarDate(new Date(receivedAt));
  return date >= window.startDate && date <= window.endDate;
}
export function gmailSearchQuery(window: ScanWindow, newerThan?: string) {
  // Search a wider UTC envelope, then enforce exact local dates after decoding.
  // This avoids Gmail's default Pacific-time interpretation of date-only queries.
  const start = validDate(newerThan) && newerThan > window.startDate && newerThan <= window.endDate ? newerThan : window.startDate;
  const after = Date.parse(`${start}T00:00:00Z`) / 1000 - 86400;
  const before = Date.parse(`${window.endDate}T00:00:00Z`) / 1000 + 2 * 86400;
  return `after:${after} before:${before} {"application" "applying" "interview" "phone screen" "offer" "candidacy" "your interest" "assessment"} -in:spam -in:trash -in:sent -in:drafts -subject:"job matches" -subject:"job alert" -subject:"new jobs"`;
}
export function isIncrementalQuery(window: ScanWindow, query: string | null) {
  const after = Number(query?.match(/\bafter:(\d+)/)?.[1]);
  const baseline = Number(gmailSearchQuery(window).match(/\bafter:(\d+)/)![1]);
  return Number.isFinite(after) && after > baseline;
}
