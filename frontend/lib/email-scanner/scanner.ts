import type { EmailAnalysis, EmailInput, EmailStatus, TrackedApplication } from "./types.ts";

// Deliberately deterministic: email text is never executed or sent to an LLM.
// Only the new portion of a reply is classified, not quoted rejection/offer text.
export function cleanEmailText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, 24000);
}

function currentMessage(value: string) {
  // Gmail and Outlook quote containers can otherwise repeat an old outcome.
  const withoutQuotes = value.replace(/<blockquote\b[^>]*>[\s\S]*$/i, "")
    .replace(/<div\b[^>]*class=["'][^"']*(?:gmail_quote|yahoo_quoted)[^"']*["'][^>]*>[\s\S]*$/i, "");
  return cleanEmailText(withoutQuotes).split(/\n\s*(?:On .{5,160}wrote:|From:\s|_{5,}|-{5,}\s*Forwarded message)/i)[0]
    .split("\n").filter((line) => !/^\s*>/.test(line)).join("\n").trim();
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\bartificial intelligence\b/g, "ai")
    .replace(/\bmachine learning\b/g, "ml").replace(/\bengineering\b/g, "engineer")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function phraseIn(haystack: string, phrase: string) {
  return Boolean(phrase) && ` ${haystack} `.includes(` ${phrase} `);
}

const roleStopWords = new Set(["a", "an", "the", "for", "of", "and", "at", "to", "in", "position", "role", "summer", "fall", "spring", "winter", "2025", "2026", "2027", "2028"]);
const companyStopWords = new Set(["inc", "llc", "ltd", "corp", "corporation", "company", "the"]);

export function matchApplications(email: EmailInput, applications: TrackedApplication[]) {
  const haystack = normalized(`${email.subject}\n${currentMessage(email.body)}`);
  const sender = email.sender.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase() ?? "";
  return applications.flatMap((app) => {
    const company = normalized(app.company).split(" ").filter((word) => !companyStopWords.has(word)).join(" ");
    const domainCompany = company.replace(/ /g, "");
    const corporateDomain = domainCompany.length >= 3 && sender.split(".").some((part) => part === domainCompany);
    if (!phraseIn(haystack, company) && !corporateDomain) return [];
    const role = normalized(app.role);
    const words = Array.from(new Set(role.split(" ").filter((word) => !roleStopWords.has(word))));
    const overlap = words.length ? words.filter((word) => phraseIn(haystack, word)).length / words.length : 0;
    const score = Math.round((0.55 + (phraseIn(haystack, role) ? 0.45 : overlap * 0.35)) * 100) / 100;
    return [{ applicationId: app.id, company: app.company, role: app.role, score }];
  }).sort((a, b) => b.score - a.score || a.applicationId.localeCompare(b.applicationId)).slice(0, 12);
}

const signals: Array<{ status: EmailStatus; patterns: RegExp[] }> = [
  { status: "rejected", patterns: [
    /\b(?:not (?:be )?(?:moving|proceeding) forward|will not be (?:moving|proceeding)|decided (?:not to (?:move|proceed)|to (?:move|proceed) (?:forward )?with other)|(?:unable|not able) to offer|(?:application|candidacy).{0,50}(?:unsuccessful|not selected)|position has been filled|you (?:have |were )?not (?:been )?selected)\b/i,
  ] },
  { status: "offer", patterns: [
    /\b(?:pleased|delighted|excited|happy) to (?:extend|offer|present).{0,65}\b(?:offer|employment|position|role|internship)\b/i,
    /\b(?:formal|written|employment|job) offer\b.{0,65}\b(?:attached|accept|enclosed|pleased)\b/i,
    /\b(?:offer letter (?:is )?(?:attached|enclosed)|we would like to offer you|we are offering you)\b/i,
  ] },
  { status: "interviewing", patterns: [
    /\b(?:invite you to|invitation to|schedule (?:your|an|a)|arrange (?:your|an|a)|confirm (?:your|an|a)|selected for|move forward with|proceed with).{0,65}\b(?:interview|phone screen|technical screen|recruiter screen)\b/i,
    /\b(?:interview|phone screen|technical screen).{0,65}\b(?:invitation|scheduled|availability|confirmed)\b/i,
  ] },
  { status: "applied", patterns: [
    /\bthank you for (?:applying|your application)\b/i,
    /\b(?:received|receiving|submitted).{0,35}\b(?:your|the) application\b/i,
    /\byour application (?:has been |was |is )?(?:received|submitted|under review)\b/i,
    /^application (?:received|confirmation)\b/i,
  ] },
];

export function analyzeEmail(email: EmailInput, applications: TrackedApplication[] = []): EmailAnalysis {
  const body = currentMessage(email.body);
  // A reply subject often describes an old status, not the new message.
  const subject = /^(?:re|fw|fwd)\s*:/i.test(email.subject.trim()) ? "" : email.subject;
  const lines = `${body}\n${subject}`.split(/\n+|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  // A generic offer advertisement or invitation to APPLY is not an application update.
  const negative = /\b(?:not an? (?:offer|interview)|no (?:offer|interview)|(?:cannot|can't|unable to) (?:schedule|offer|invite)|not (?:inviting|offering)|offer (?:has been |was )?(?:withdrawn|rescinded)|interview (?:has been |was )?cancelled)\b/i;
  const hits = signals.flatMap(({ status, patterns }) => {
    const evidence = lines.find((line) => ((status !== "offer" && status !== "interviewing") || !negative.test(line)) && patterns.some((pattern) => pattern.test(line)));
    return evidence ? [{ status, evidence }] : [];
  });
  // Receipt text often accompanies an invitation. Conflicting terminal outcomes
  // require review instead of silently deciding that one is the latest outcome.
  const terminal = hits.filter((hit) => hit.status !== "applied");
  const conflict = terminal.length > 1;
  const hit = conflict ? null : terminal[0] ?? hits[0] ?? null;
  const candidates = matchApplications({ ...email, body }, applications);
  const best = candidates[0];
  const clearMatch = best && (!candidates[1] || best.score - candidates[1].score >= 0.15);
  const companyMatch = body.match(/\b(?:thank you for applying to|your application (?:to|with))\s+([^\n.!?]{2,70})/i);
  const roleMatch = body.match(/\b(?:for the|for our)\s+([^\n.!?]{2,100}?)\s+(?:position|role)\b/i);
  const actionDate = body.match(/\b\d{4}-\d{2}-\d{2}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+20\d{2})?\b/i);
  return {
    status: hit?.status ?? null,
    confidence: hit && clearMatch ? "high" : hit ? "review" : "unknown",
    evidence: (hit?.evidence ?? terminal.map((item) => item.evidence).join(" ")).slice(0, 400),
    company: clearMatch ? best.company : companyMatch?.[1]?.trim().slice(0, 100) ?? "",
    role: clearMatch ? best.role : roleMatch?.[1]?.trim().slice(0, 160) ?? "",
    actionDateText: actionDate?.[0] ?? "",
    candidates,
    suggestedApplicationId: clearMatch ? best.applicationId : null,
    explanation: conflict ? "Conflicting status signals. Review the original email and update your board manually."
      : !hit ? "No reliable application status was found. No board change is suggested."
      : !clearMatch ? "Choose the application yourself. The message does not identify one tracked role clearly."
      : "A status phrase and application match were found. Confirm both before updating your board.",
  };
}
