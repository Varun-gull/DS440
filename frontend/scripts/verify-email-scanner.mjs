import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { analyzeEmail, cleanEmailText, matchApplications } from "../lib/email-scanner/scanner.ts";
import { encryptToken, decryptToken } from "../lib/email-scanner/crypto.ts";
import { decodeGmailMessage } from "../lib/email-scanner/gmail-message.ts";

let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
const applications = [
  { id: "a", company: "ExampleCo", role: "AI Engineer Internship", status: "applied", updated_at: "2026-10-01T12:00:00Z" },
  { id: "b", company: "ExampleCo", role: "Marketing Internship", status: "applied", updated_at: "2026-10-01T12:00:00Z" },
  { id: "c", company: "OtherCo", role: "AI Engineer Internship", status: "saved", updated_at: "2026-10-01T12:00:00Z" },
];
const email = (body, subject = "Application update", sender = "Recruiting <jobs@exampleco.com>") => ({ body, subject, sender, receivedAt: "2026-10-28T12:00:00Z" });

check("application receipt", () => assert.equal(analyzeEmail(email("Thank you for applying to ExampleCo.")).status, "applied"));
check("receipt subject without body template", () => assert.equal(analyzeEmail(email("We will contact you soon.", "Application received")).status, "applied"));
check("interview plus receipt selects interview", () => {
  const result = analyzeEmail(email("Thank you for applying to ExampleCo. We would like to invite you to interview for the AI Engineer Internship position."), applications);
  assert.equal(result.status, "interviewing"); assert.equal(result.suggestedApplicationId, "a");
});
check("job offer", () => assert.equal(analyzeEmail(email("We are pleased to extend an offer of employment for the AI Engineer Internship position at ExampleCo.")).status, "offer"));
check("rejection", () => assert.equal(analyzeEmail(email("We will not be moving forward with your application.")).status, "rejected"));
check("unable to offer means rejection, not an offer", () => assert.equal(analyzeEmail(email("We are unable to offer you the position.")).status, "rejected"));
check("common rejection phrasing", () => assert.equal(analyzeEmail(email("We have decided to proceed with other candidates.")).status, "rejected"));
check("newsletter is not an offer", () => assert.equal(analyzeEmail(email("Special offer: get 20 percent off our interview course.", "Career newsletter")).status, null));
check("invitation to apply is not an interview", () => assert.equal(analyzeEmail(email("We invite you to apply for our open roles.")).status, null));
check("generic regret does not mean rejection", () => assert.equal(analyzeEmail(email("We regret to inform you that the office is closed today.")).status, null));
check("negative invitation does not confirm interview", () => assert.equal(analyzeEmail(email("We cannot invite you to interview at this time.")).status, null));
check("conflicting terminal statuses need manual review", () => assert.equal(analyzeEmail(email("We would like to invite you to interview. We will not be moving forward with your application.")).status, null));
check("quoted text does not create status", () => assert.equal(analyzeEmail(email("Thanks for your reply.\nOn October 1, Recruiting wrote:\nWe would like to invite you to interview.")).status, null));
check("reply subject alone does not repeat an old status", () => assert.equal(analyzeEmail(email("Thanks for your reply.", "Re: Interview invitation")).status, null));
check("blockquote history does not create status", () => assert.equal(analyzeEmail(email("<p>Thanks for the update.</p><blockquote>We would like to offer you a position.</blockquote>")).status, null));
check("plain quoted lines are ignored", () => assert.equal(analyzeEmail(email("Thanks.\n> We would like to offer you a position.")).status, null));
check("same company ambiguous roles stay unselected", () => assert.equal(analyzeEmail(email("Thank you for applying to ExampleCo."), applications).suggestedApplicationId, null));
check("other company does not match from generic role alone", () => assert.equal(matchApplications(email("Invitation for an AI Engineer Internship at UnknownCo.", "Update", "Recruiter <jobs@ats.example>"), applications).length, 0));
check("company words require boundaries", () => assert.equal(matchApplications(email("This is a newsletter about boxwood.", "Newsletter", "news@newsletter.example"), [{ ...applications[0], company: "Box" }]).length, 0));
check("AI alias supports role matching", () => assert.equal(analyzeEmail(email("We invite you to interview for the Artificial Intelligence Engineer Internship position at ExampleCo."), applications).suggestedApplicationId, "a"));
check("date is an uncommitted text hint", () => assert.equal(analyzeEmail(email("We invite you to interview on November 12, 2026.")).actionDateText, "November 12, 2026"));
check("HTML scripts are not evidence", () => assert.equal(analyzeEmail(email("<script>We would like to offer you a position.</script><p>Hello.</p>")).status, null));
check("evidence and text limits", () => { assert.ok(analyzeEmail(email(`Thank you for applying. ${"a".repeat(900)}`)).evidence.length <= 400); assert.equal(cleanEmailText("a".repeat(30000)).length, 24000); });

const key = randomBytes(32).toString("base64");
const sealed = encryptToken("synthetic refresh credential", key, "user-a");
check("credentials round trip", () => assert.equal(decryptToken(sealed, key, "user-a"), "synthetic refresh credential"));
check("credentials are not plaintext", () => assert.ok(!sealed.includes("synthetic")));
check("credentials are bound to their owner", () => assert.throws(() => decryptToken(sealed, key, "user-b")));
check("tampered credential is rejected", () => { const parts = sealed.split("."); const bytes = Buffer.from(parts[3], "base64url"); bytes[0] ^= 1; parts[3] = bytes.toString("base64url"); assert.throws(() => decryptToken(parts.join("."), key, "user-a")); });
check("weak encryption keys rejected", () => assert.throws(() => encryptToken("secret", "bad-key", "user-a")));

const encoded = (value) => Buffer.from(value).toString("base64url");
const gmail = { id: "mail-a", threadId: "thread-a", internalDate: "1793188800000", payload: { mimeType: "multipart/mixed", headers: [{ name: "Subject", value: "Application received" }, { name: "From", value: "jobs@exampleco.com" }], parts: [
  { mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: encoded("Thank you for applying.") } }, { mimeType: "text/html", body: { data: encoded("<p>Alternative duplicate text.</p>") } }] },
  { mimeType: "text/plain", filename: "attachment.txt", body: { data: encoded("We would like to offer you a position.") } },
] } };
check("MIME nested parts prefer plain and ignore attachments", () => { const result = decodeGmailMessage(gmail); assert.equal(result.body, "Thank you for applying."); assert.equal(result.subject, "Application received"); });
check("MIME HTML fallback preserves quotes for classifier", () => {
  const result = decodeGmailMessage({ ...gmail, payload: { mimeType: "text/html", body: { data: encoded("<p>Hello</p><blockquote>We would like to offer you a position.</blockquote>") } } });
  assert.equal(analyzeEmail(result).status, null);
});
check("invalid Gmail date is rejected", () => assert.throws(() => decodeGmailMessage({ ...gmail, internalDate: "not-a-date" })));
console.log(`${passed} email scanner checks passed. Synthetic data only; these are rule checks, not measured real world accuracy.`);
