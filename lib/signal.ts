import { getTodayKey } from "./streak";

/**
 * The signal ramp.
 *
 * Colour in this app is spent on one thing: measurements that have a direction,
 * where better and worse are real. Fit score and deadline pressure qualify.
 * Categorical facts — work mode, source, tags — stay neutral, so a green chip
 * always means "this is going well" and never just "this is a different kind of
 * thing."
 *
 * Four bands, read like an instrument coming up to temperature: idle slate,
 * caution amber, nominal brand blue, peak emerald.
 *
 * Each band is a single hue value used for both the numeral and the bar fill.
 * The lighter -500 weights looked more vivid but only reached ~2:1 against the
 * pale meter track, which makes the end of the bar hard to locate; the -700
 * weights clear 4.5:1 as text and 3:1 as a fill, so one value does both jobs.
 */

export type SignalBand = "peak" | "nominal" | "caution" | "idle";

type BandStyle = {
  /** Foreground for numerals and short labels. */
  text: string;
  /** Solid fill for meter bars and dots. */
  fill: string;
  /** Tinted background plus matching ring, for chips. */
  chip: string;
};

const BAND_STYLES: Record<SignalBand, BandStyle> = {
  peak: {
    text: "text-emerald-700",
    fill: "bg-emerald-700",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200"
  },
  nominal: {
    text: "text-[#2A6384]",
    fill: "bg-[#2A6384]",
    chip: "bg-[#EAF2F8] text-[#214E69] ring-[#2A6384]/25"
  },
  caution: {
    text: "text-amber-700",
    fill: "bg-amber-700",
    chip: "bg-amber-50 text-amber-800 ring-amber-200"
  },
  idle: {
    text: "text-slate-500",
    fill: "bg-slate-500",
    chip: "bg-slate-100 text-slate-600 ring-slate-200"
  }
};

export function bandStyle(band: SignalBand) {
  return BAND_STYLES[band];
}

/**
 * Fit is the resume-to-role match, 0–100. Thresholds are set where the advice
 * actually changes: above 85 apply now, 70–85 apply, 55–70 worth a look if you
 * tailor the resume, below that it is a long shot.
 */
export function fitBand(fitScore: number): SignalBand {
  if (fitScore >= 85) return "peak";
  if (fitScore >= 70) return "nominal";
  if (fitScore >= 55) return "caution";
  return "idle";
}

export function fitLabel(fitScore: number) {
  const band = fitBand(fitScore);
  if (band === "peak") return "Strong match";
  if (band === "nominal") return "Good match";
  if (band === "caution") return "Partial match";
  return "Long shot";
}

/** Days from today to a `YYYY-MM-DD` date, or null when the date is unusable. */
export function daysUntil(dateKey: string | null | undefined) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const target = Date.parse(`${dateKey}T00:00:00Z`);
  const today = Date.parse(`${getTodayKey()}T00:00:00Z`);

  if (Number.isNaN(target) || Number.isNaN(today)) {
    return null;
  }

  return Math.round((target - today) / 86_400_000);
}

/**
 * Deadline pressure runs the ramp in reverse — plenty of time is the calm state,
 * and rose is reserved for a date you have already passed. Overdue is the only
 * place in the app that gets rose, so it cannot be mistaken for anything else.
 */
export type DeadlineUrgency = "overdue" | "today" | "soon" | "later" | "none";

export function deadlineUrgency(dateKey: string | null | undefined): DeadlineUrgency {
  const days = daysUntil(dateKey);

  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days <= 1) return "today";
  if (days <= 5) return "soon";
  return "later";
}

const DEADLINE_STYLES: Record<DeadlineUrgency, string> = {
  overdue: "text-rose-700",
  today: "text-rose-700",
  soon: "text-amber-700",
  later: "text-slate-600",
  none: "text-slate-600"
};

export function deadlineStyle(urgency: DeadlineUrgency) {
  return DEADLINE_STYLES[urgency];
}

/** Prefix that says what the date means, so urgency is not carried by colour alone. */
export function deadlinePrefix(urgency: DeadlineUrgency) {
  if (urgency === "overdue") return "Past due";
  if (urgency === "today") return "Due now";
  return "Due";
}

/** A posting published today or yesterday is worth surfacing over an older one. */
export function isFreshPosting(postedAt: string) {
  return /^[01]d$/.test(postedAt.trim());
}
