const APP_TIME_ZONE = "America/New_York";

export function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return zonedTimeAsUtc - date.getTime();
}

export function getDateKeyStartUtcIso(dateKey = getTodayKey()) {
  const tentativeUtcMidnight = new Date(`${dateKey}T00:00:00.000Z`);
  return new Date(tentativeUtcMidnight.getTime() - getTimeZoneOffsetMs(tentativeUtcMidnight)).toISOString();
}

function dateKeyToUtcTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getDateKeyDiff(fromDateKey: string | null, toDateKey = getTodayKey()) {
  if (!fromDateKey) {
    return null;
  }

  return Math.round((dateKeyToUtcTime(toDateKey) - dateKeyToUtcTime(fromDateKey)) / 86_400_000);
}

export function isProtectedStreakGap(lastAppliedOn: string | null, today: string, protectedDays: string[] = []) {
  const diff = getDateKeyDiff(lastAppliedOn, today);
  if (diff === null) return false;
  if (diff <= 1) return true;
  if (diff > 8) return false;
  const covered = new Set(protectedDays);
  for (let day = 1; day < diff; day++) {
    const key = new Date(dateKeyToUtcTime(lastAppliedOn!) + day * 86400000).toISOString().slice(0, 10);
    if (!covered.has(key)) return false;
  }
  return true;
}

export function getVisibleStreak(lastAppliedOn: string | null, currentStreak: number, protectedDays: string[] = []) {
  const dayDiff = getDateKeyDiff(lastAppliedOn);

  if (dayDiff === null) {
    return 0;
  }

  if (isProtectedStreakGap(lastAppliedOn, getTodayKey(), protectedDays)) {
    return currentStreak;
  }

  return 0;
}

export function getNextStreak(lastAppliedOn: string | null, currentStreak: number, protectedDays: string[] = []) {
  const dayDiff = getDateKeyDiff(lastAppliedOn);

  if (dayDiff === 0) {
    return currentStreak;
  }

  if (dayDiff !== null && dayDiff > 0 && isProtectedStreakGap(lastAppliedOn, getTodayKey(), protectedDays)) {
    return currentStreak + 1;
  }

  return 1;
}

export function isBrokenStreak(lastAppliedOn: string | null, currentStreak: number, protectedDays: string[] = []) {
  const dayDiff = getDateKeyDiff(lastAppliedOn);
  return currentStreak > 0 && dayDiff !== null && dayDiff > 1 && !isProtectedStreakGap(lastAppliedOn, getTodayKey(), protectedDays);
}
