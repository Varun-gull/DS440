import type { LucideIcon } from "lucide-react";
import { Metric } from "@/components/Metric";

export function DashboardCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "bg-emerald-500 text-white",
  step = 0
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: string;
  /** Position in the row, used to stage the entrance and the count-up. */
  step?: number;
}) {
  const numericValue = Number(value.replace(/,/g, ""));
  const isNumeric = value.trim() !== "" && Number.isFinite(numericValue);

  return (
    <section
      className="card card-interactive rise group p-5"
      style={{ ["--rise-delay" as string]: `${60 + step * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-label">{title}</p>
          <p className="font-display mt-2 text-3xl font-bold tracking-tight text-ink">
            {isNumeric ? <Metric value={numericValue} delay={180 + step * 60} /> : value}
          </p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform duration-200 ease-out group-hover:scale-105 ${tone}`}>
          <Icon size={23} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{helper}</p>
    </section>
  );
}
