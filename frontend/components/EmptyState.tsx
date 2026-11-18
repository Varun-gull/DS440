import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="empty-state card flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef3fc] text-[#2456a6] ring-1 ring-inset ring-[#2456a6]/15">
        <Icon size={28} />
      </div>
      <h2 className="font-display mt-5 text-xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      <Link href={actionHref} className="primary-button mt-6">
        {actionLabel}
      </Link>
    </section>
  );
}
