"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { applicationBadges } from "@/lib/badges/catalog";
import {
  avatarOptions,
  themeOptions,
  type RewardsState,
} from "@/lib/rewards/store";
import { RewardAvatar, type RewardAction } from "./RewardUI";
export function RewardCustomization({
  state,
  act,
  busy,
  done,
}: {
  state: RewardsState;
  act: RewardAction;
  busy: boolean;
  done(): void;
}) {
  const [theme, setTheme] = useState(state.preferences.theme),
    [avatar, setAvatar] = useState(state.preferences.avatar),
    [badge, setBadge] = useState(state.preferences.badge);
  const selected = themeOptions.find((t) => t.id === theme)!;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await act(
            { action: "appearance", theme, avatar, badge },
            "Your new look is saved.",
          )
        )
          done();
      }}
    >
      <div
        className="reward-profile-preview"
        style={{ background: selected.canvas, color: selected.color }}
      >
        <div className="reward-preview-avatar">
          <RewardAvatar avatar={avatar} name={state.name} size={32} />
        </div>
        <div>
          <strong>{state.name}</strong>
          <p>
            {applicationBadges.find((b) => b.id === badge)?.label ||
              "Building a career, one step at a time"}
          </p>
        </div>
      </div>
      <fieldset className="reward-fieldset">
        <legend>Choose your atmosphere</legend>
        <div className="reward-choice-grid">
          {themeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={theme === option.id}
              className={`reward-theme-choice ${theme === option.id ? "selected" : ""}`}
              disabled={busy}
              onClick={() => setTheme(option.id)}
            >
              <span style={{ background: option.canvas }}>
                <i style={{ background: option.color }} />
              </span>
              <strong>{option.label}</strong>
              {theme === option.id && <Check size={15} />}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="reward-fieldset">
        <legend>Pick an avatar</legend>
        <div className="reward-avatar-choices">
          {avatarOptions.map((option) => (
            <button
              key={option}
              className={avatar === option ? "selected" : ""}
              type="button"
              aria-pressed={avatar === option}
              disabled={busy}
              onClick={() => setAvatar(option)}
            >
              <RewardAvatar avatar={option} name={state.name} />
              <span className="capitalize">{option}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="reward-label">
        Featured achievement
        <select
          className="reward-input"
          value={badge}
          disabled={busy}
          onChange={(e) => setBadge(e.target.value)}
        >
          <option value="">Keep it simple</option>
          {applicationBadges
            .filter((b) => state.applicationsApplied >= b.threshold)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
        </select>
      </label>
      <p className="reward-footnote">
        Choose achievements you have already earned. Your theme, avatar, and
        badge appear across your own CareerUp pages.
      </p>
      <button className="reward-primary reward-full" disabled={busy}>
        {busy ? "Saving…" : "Save my look"}
      </button>
    </form>
  );
}
