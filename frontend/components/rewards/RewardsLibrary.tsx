"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AudioLines,
  ArrowRight,
  Check,
  Download,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  canRefund,
  rewardById,
  type Redemption,
  type RewardsState,
  type RewardArtifact,
} from "@/lib/rewards/store";
import { artifactText, plainArtifactItem } from "@/lib/rewards/artifacts";
import {
  RewardIcon,
  RewardModal,
  dateLabel,
  type RewardAction,
} from "./RewardUI";
import { RewardCustomization } from "./RewardCustomization";
import { RewardInsights } from "./RewardInsights";
import { getTodayKey } from "@/lib/streak";

export function RewardsLibrary({
  state,
  act,
  busy,
  shop,
  together,
  error,
}: {
  state: RewardsState;
  act: RewardAction;
  busy: boolean;
  shop(): void;
  together(): void;
  error: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [returnId, setReturnId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState(""),
    [jobDescription, setJobDescription] = useState(""),
    [resume, setResume] = useState(false),
    [consent, setConsent] = useState(false),
    [reflection, setReflection] = useState("");
  const [skillFocus, setSkillFocus] = useState("");
  const [day, setDay] = useState(getTodayKey());
  const [reports, setReports] = useState<Record<string, RewardArtifact>>({}),
    [reportError, setReportError] = useState(""),
    [reportAttempt, setReportAttempt] = useState(0);
  const rawSelected = state.redemptions.find((r) => r.id === selectedId);
  const selected = rawSelected
      ? { ...rawSelected, content: reports[rawSelected.id] ?? null }
      : undefined,
    definition = selected ? rewardById(selected.reward_id) : null;
  const hasReport = Boolean(rawSelected?.hasContent),
    cachedReport = selectedId ? reports[selectedId] : null;
  useEffect(() => {
    if (!selectedId || !hasReport || cachedReport) return;
    const controller = new AbortController();
    setReportError("");
    fetch(`/api/rewards?redemptionId=${encodeURIComponent(selectedId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error || "Your report could not be loaded.");
        if (!controller.signal.aborted)
          setReports((current) => ({
            ...current,
            [selectedId]: value.content,
          }));
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setReportError(
            failure instanceof Error
              ? failure.message
              : "Your report could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [selectedId, hasReport, cachedReport, reportAttempt]);
  const entries = state.redemptions.filter(
    (r) => r.status !== "refunded" && rewardById(r.reward_id),
  );
  const tomorrowLimit = new Date(`${getTodayKey()}T12:00:00Z`);
  tomorrowLimit.setUTCDate(tomorrowLimit.getUTCDate() + 7);
  function open(item: Redemption) {
    setSelectedId(item.id);
    setJobTitle("");
    setJobDescription("");
    setResume(false);
    setConsent(false);
    setReflection("");
    setSkillFocus("");
  }
  function download(item: Redemption) {
    if (!item.content) return;
    const url = URL.createObjectURL(
      new Blob([artifactText(item.content)], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "CareerUp preparation report.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="reward-library-summary">
        <div>
          <AudioLines size={22} />
          <strong>{state.voiceCredits}</strong>
          <span>extra interview credits</span>
          <Link href="/interview/assistant">
            Start practicing <ArrowRight size={15} />
          </Link>
        </div>
        <div>
          <ShieldCheck size={22} />
          <strong>
            {state.shieldDays.filter((d) => d >= getTodayKey()).length}
          </strong>
          <span>planned days protected</span>
          <span className="reward-footnote">A little space to recharge.</span>
        </div>
      </div>
      {state.insights && <RewardInsights report={state.insights} />}
      <div className="reward-section-heading">
        <div>
          <p className="reward-kicker">Ready when you are</p>
          <h2>Your rewards, all in one place.</h2>
        </div>
        <button type="button" className="reward-secondary" onClick={shop}>
          Explore rewards <ArrowRight size={15} />
        </button>
      </div>
      {!entries.length && !state.legacy.length ? (
        <div className="reward-empty">
          <RewardIcon kind="interview" size={38} />
          <h3>Your next advantage starts here.</h3>
          <p>
            Choose a reward in the shop. Your tools, reports, and unused credits
            will live here.
          </p>
          <button type="button" className="reward-primary" onClick={shop}>
            Find your first reward
          </button>
        </div>
      ) : (
        <div className="reward-library-grid">
          {entries.map((item) => {
            const reward = rewardById(item.reward_id)!;
            const labels = {
              available: "Ready to use",
              generating: "Preparing your report",
              ready: "Yours to keep",
              used: reward.kind === "skill" ? "Reflection saved" : "Used",
              refunded: "Returned",
            };
            const actionable =
              item.status !== "used" || Boolean(item.hasContent);
            return (
              <article className="reward-library-card" key={item.id}>
                <div className={`reward-card-icon reward-icon-${reward.kind}`}>
                  <RewardIcon kind={reward.kind} size={21} />
                </div>
                <div className="reward-library-main">
                  <span
                    className={`reward-status ${item.status === "used" ? "reward-status-muted" : ""}`}
                  >
                    {labels[item.status]}
                  </span>
                  <h3>{reward.title}</h3>
                  <p>
                    {item.details.source
                      ? String(item.details.source)
                      : `Redeemed ${dateLabel(item.created_at)}`}
                    {item.details.protectedOn
                      ? ` · Protected ${dateLabel(String(item.details.protectedOn))}`
                      : ""}
                  </p>
                  <div className="reward-library-actions">
                    {actionable &&
                      reward.kind !== "insights" &&
                      (reward.kind === "voice" ? (
                        <Link
                          className="reward-text-button"
                          href="/interview/assistant"
                        >
                          Open interview practice <ArrowRight size={14} />
                        </Link>
                      ) : reward.kind === "challenge" ? (
                        <button
                          type="button"
                          onClick={together}
                          className="reward-text-button"
                        >
                          Create a challenge <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="reward-text-button"
                          onClick={() => open(item)}
                        >
                          {item.hasContent
                            ? "Read your report"
                            : reward.kind === "appearance"
                              ? "Customize your look"
                              : reward.kind === "shield"
                                ? "Plan a day off"
                                : "Prepare this tool"}
                          <ArrowRight size={14} />
                        </button>
                      ))}
                    {canRefund(item) && (
                      <button
                        type="button"
                        className="reward-return"
                        disabled={busy}
                        onClick={() => setReturnId(item.id)}
                      >
                        Return unused reward
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {state.legacy.length > 0 && (
        <section className="reward-legacy">
          <h3>Your earlier resources are still here.</h3>
          <p className="reward-footnote">
            Everything you previously unlocked stays in your library.
          </p>
          {state.legacy.map((item) => (
            <details key={item.id}>
              <summary>{item.title}</summary>
              <ol>
                {item.contents.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ol>
            </details>
          ))}
        </section>
      )}
      {selected && definition && (
        <RewardModal
          title={selected.content?.title || definition.title}
          wide={Boolean(selected.hasContent)}
          busy={busy}
          error={error}
          close={() => setSelectedId(null)}
        >
          {definition.kind === "appearance" ? (
            <RewardCustomization
              state={state}
              act={act}
              busy={busy}
              done={() => setSelectedId(null)}
            />
          ) : definition.kind === "shield" ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await act(
                    { action: "protect", redemptionId: selected.id, day },
                    "Your day off is protected. Enjoy the breathing room.",
                  )
                )
                  setSelectedId(null);
              }}
            >
              <p className="reward-modal-intro">
                Keep your streak while taking a planned break. This pass
                protects one selected day without adding XP or application
                credit.
              </p>
              <label className="reward-label">
                Your day off
                <input
                  className="reward-input"
                  type="date"
                  min={getTodayKey()}
                  max={tomorrowLimit.toISOString().slice(0, 10)}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  required
                  disabled={busy}
                />
              </label>
              <p className="reward-footnote">
                Choose today or a day in the next week. Up to two days can be
                protected in any seven day period. Already broken streaks cannot
                be repaired by planning a future day off.
              </p>
              {state.shieldDays.length > 0 && (
                <p className="reward-footnote">
                  Your protected dates:{" "}
                  {state.shieldDays.map(dateLabel).join(", ")}
                </p>
              )}
              <button className="reward-primary reward-full" disabled={busy}>
                {busy ? "Protecting…" : "Protect this day"}
              </button>
            </form>
          ) : selected.hasContent && !selected.content ? (
            <div>
              <p
                className="reward-modal-intro"
                role={reportError ? "alert" : "status"}
              >
                {reportError || "Loading your private report…"}
              </p>
              {reportError && (
                <button
                  className="reward-secondary"
                  onClick={() => setReportAttempt((value) => value + 1)}
                >
                  Try loading again
                </button>
              )}
            </div>
          ) : selected.content ? (
            <div className="reward-artifact">
              <p className="reward-modal-intro">{selected.content.summary}</p>
              {selected.content.sections.map((section, index) => (
                <section key={index}>
                  <h3>{section.title}</h3>
                  <ol>
                    {section.items.map((item, i) => (
                      <li key={i}>{plainArtifactItem(item)}</li>
                    ))}
                  </ol>
                </section>
              ))}
              <p className="reward-footnote">
                AI guidance can be inaccurate. Check it against the original
                posting and use only evidence that reflects your actual
                experience.
              </p>
              <button
                type="button"
                className="reward-secondary"
                onClick={() => download(selected)}
              >
                <Download size={16} />
                Download report
              </button>
              {definition.kind === "skill" && selected.status === "ready" && (
                <form
                  className="reward-reflection"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await act(
                        {
                          action: "completeSkill",
                          redemptionId: selected.id,
                          reflection,
                        },
                        "Reflection saved. Your exercise is recorded as self reported progress.",
                      )
                    )
                      setReflection("");
                  }}
                >
                  <h3>What did you learn?</h3>
                  <p>
                    After completing the exercise, describe what you built, what
                    was difficult, and what you would improve.
                  </p>
                  <label className="reward-label">
                    Your reflection
                    <textarea
                      className="reward-input"
                      rows={4}
                      minLength={80}
                      maxLength={2000}
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </label>
                  <p className="reward-footnote">
                    Self reported completion. Earn up to 4 RP once for this
                    exercise, within the daily earning cap.
                  </p>
                  <button
                    className="reward-primary"
                    disabled={busy || reflection.trim().length < 80}
                  >
                    <Check size={16} />
                    Save my reflection
                  </button>
                </form>
              )}
              {selected.details.reflection ? (
                <div className="reward-reflection">
                  <h3>Your saved reflection</h3>
                  <p>{String(selected.details.reflection)}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await act(
                  {
                    action: "generate",
                    redemptionId: selected.id,
                    jobTitle,
                    jobDescription,
                    includeResume: resume,
                    consent,
                    skillFocus,
                  },
                  "Your personal report is ready in the library.",
                );
              }}
            >
              <p className="reward-modal-intro">
                Make this useful for your next move. Add the actual job
                description so the guidance is specific to the opportunity.
              </p>
              <label className="reward-label">
                Role and company
                <input
                  className="reward-input"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  maxLength={160}
                  placeholder="AI Engineer Intern at Example"
                  required
                  disabled={busy}
                />
              </label>
              <label className="reward-label">
                Job description
                <textarea
                  className="reward-input"
                  rows={6}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  minLength={80}
                  maxLength={8000}
                  placeholder="Paste the responsibilities and qualifications from the posting…"
                  required
                  disabled={busy}
                />
              </label>
              {definition.kind === "skill" && (
                <label className="reward-label">
                  Skill focus, optional
                  <input
                    className="reward-input"
                    value={skillFocus}
                    maxLength={100}
                    onChange={(e) => setSkillFocus(e.target.value)}
                    placeholder="SQL joins, model evaluation, or a skill you want to strengthen"
                    disabled={busy}
                  />
                </label>
              )}
              <label className="reward-check">
                <input
                  type="checkbox"
                  checked={resume}
                  onChange={(e) => setResume(e.target.checked)}
                  disabled={busy || !state.hasResume}
                />
                <span>
                  Include my saved resume for more personal guidance.
                  {definition.kind === "resume"
                    ? " Required for a resume review."
                    : " Optional."}
                </span>
              </label>
              {!state.hasResume && (
                <p className="reward-footnote">
                  <Link href="/profile" className="underline">
                    Add your resume on your profile
                  </Link>{" "}
                  to include it here.
                </p>
              )}
              <label className="reward-check reward-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                  required
                />
                <span>
                  I agree to send this job description and my resume only if
                  selected to Google. The generated report will be saved
                  privately in my CareerUp rewards library.
                </span>
              </label>
              <p className="reward-footnote">
                Your reward pays for one saved report. Preparing it does not
                spend more points or use your daily chat messages. Busy requests may take up to four minutes. You can retry
                an unsuccessful request.
              </p>
              <button
                className="reward-primary reward-full"
                disabled={
                  busy || !consent || (definition.kind === "resume" && !resume)
                }
              >
                {busy ? (
                  <>
                    <LoaderCircle size={17} className="animate-spin" />
                    Preparing your report…
                  </>
                ) : (
                  "Create my personal report"
                )}
              </button>
            </form>
          )}
        </RewardModal>
      )}
      {returnId && (
        <RewardModal
          title="Return this unused reward?"
          error={error}
          busy={busy}
          close={() => setReturnId(null)}
        >
          <p className="reward-modal-intro">
            The reward will leave your library and its{" "}
            {state.redemptions.find((r) => r.id === returnId)?.cost} points will
            return to your balance. Your lifetime XP stays the same.
          </p>
          <div className="reward-modal-actions">
            <button
              className="reward-secondary"
              disabled={busy}
              onClick={() => setReturnId(null)}
            >
              Keep my reward
            </button>
            <button
              className="reward-primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await act(
                    { action: "refund", redemptionId: returnId },
                    "Your points have been returned.",
                  )
                )
                  setReturnId(null);
              }}
            >
              {busy ? "Returning…" : "Return reward"}
            </button>
          </div>
        </RewardModal>
      )}
    </>
  );
}
