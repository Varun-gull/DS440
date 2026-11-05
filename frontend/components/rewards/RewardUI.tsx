"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  AudioLines,
  BookOpen,
  ChartNoAxesCombined,
  Compass,
  FileSearch,
  Gift,
  GraduationCap,
  Paintbrush,
  Rocket,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import type { RewardKind, RewardPreferences } from "@/lib/rewards/store";

export function RewardIcon({
  kind,
  size = 24,
}: {
  kind: RewardKind;
  size?: number;
}) {
  const Icon = {
    voice: AudioLines,
    resume: FileSearch,
    interview: BookOpen,
    skill: Target,
    insights: ChartNoAxesCombined,
    appearance: Paintbrush,
    shield: ShieldCheck,
    challenge: Users,
    pool: Gift,
    workshop: GraduationCap,
  }[kind];
  return <Icon size={size} aria-hidden />;
}
export function RewardAvatar({
  avatar,
  name,
  size = 28,
}: {
  avatar: RewardPreferences["avatar"];
  name: string;
  size?: number;
}) {
  const Icon = { compass: Compass, rocket: Rocket, graduate: GraduationCap }[
    avatar as "compass" | "rocket" | "graduate"
  ];
  return Icon ? (
    <Icon size={size} aria-hidden />
  ) : (
    <span aria-hidden>
      {/^[A-Z]{1,3}$/.test(name)
        ? name
        : name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0])
            .join("")
            .toUpperCase()}
    </span>
  );
}
export function RewardModal({
  title,
  children,
  close,
  busy = false,
  wide = false,
  error = "",
}: {
  title: string;
  children: ReactNode;
  close(): void;
  busy?: boolean;
  wide?: boolean;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`reward-modal ${wide ? "reward-modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div className="reward-modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="reward-icon-button"
          onClick={close}
          disabled={busy}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      <div className="reward-modal-body">
        {children}
        {error && (
          <p className="reward-inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
export type RewardAction = (
  body: Record<string, unknown>,
  message: string,
) => Promise<boolean>;
export function dateLabel(value: string) {
  return new Date(
    value.length === 10 ? `${value}T12:00:00` : value,
  ).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
