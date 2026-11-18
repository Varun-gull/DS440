import { ArrowUpRight } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className="brand-lockup">
    <span className="brand-symbol" aria-hidden><ArrowUpRight size={22} strokeWidth={2.7} /></span>
    {!compact && <span>Career<span className="brand-up">Up</span></span>}
  </span>;
}
