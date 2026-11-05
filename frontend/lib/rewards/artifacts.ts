import type { RewardArtifact } from "./store";
export function plainArtifactItem(value: string) {
  return value.replace(/^\s*(?:\d+[.)]\s+|[•*\-]\s+)/, "");
}

export function parseRewardArtifact(value: unknown): RewardArtifact {
  const text = (v: unknown, limit: number) => {
    if (typeof v !== "string" || !v.trim() || v.length > limit)
      throw new Error("The AI report was incomplete. Please try again.");
    return v.trim();
  };
  if (!value || typeof value !== "object")
    throw new Error("The AI report was incomplete. Please try again.");
  const item = value as Record<string, unknown>;
  if (
    !Array.isArray(item.sections) ||
    item.sections.length < 2 ||
    item.sections.length > 8
  )
    throw new Error("The AI report was incomplete. Please try again.");
  return {
    title: text(item.title, 180),
    summary: text(item.summary, 1800),
    sections: item.sections.map((section: unknown) => {
      if (!section || typeof section !== "object")
        throw new Error("The AI report was incomplete. Please try again.");
      const s = section as Record<string, unknown>;
      if (!Array.isArray(s.items) || !s.items.length || s.items.length > 10)
        throw new Error("The AI report was incomplete. Please try again.");
      return {
        title: text(s.title, 180),
        items: s.items.map((v) => plainArtifactItem(text(v, 2000))),
      };
    }),
  };
}

export function artifactText(report: RewardArtifact) {
  return `${report.title}\n\n${report.summary}\n\n${report.sections.map((section) => `${section.title}\n${section.items.map((item, index) => `${index + 1}. ${plainArtifactItem(item)}`).join("\n\n")}`).join("\n\n")}\n\nCareerUp AI guidance. Review suggestions and use only truthful evidence.\n`;
}
