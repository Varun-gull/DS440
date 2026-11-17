import { Bot, Sparkles } from "lucide-react";

export type InterviewPhase = "ready" | "connecting" | "queued" | "listening" | "speaking" | "muted";

export function InterviewAvatar({ phase }: { phase: InterviewPhase }) {
  return <div className="interview-avatar" data-phase={phase} aria-hidden="true">
    <div className="interview-avatar-orbit interview-avatar-orbit-outer" />
    <div className="interview-avatar-orbit interview-avatar-orbit-inner" />
    <div className="interview-avatar-face"><Bot strokeWidth={1.25} /><span className="interview-avatar-spark"><Sparkles size={20} strokeWidth={1.6} /></span></div>
    <div className="interview-avatar-wave">{[0, 1, 2, 3, 4].map(index => <span key={index} style={{ animationDelay: `${index * 90}ms` }} />)}</div>
  </div>;
}
