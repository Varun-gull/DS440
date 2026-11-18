import Link from "next/link";
import type { ReactNode } from "react";

export type HeroTab = { label: string; href: string; active?: boolean };
export function PageHero({ eyebrow, title, description, tabs, actions }: { eyebrow?: string; title: string; description?: string; tabs?: HeroTab[]; actions?: ReactNode; compact?: boolean }) {
  return <header className="workspace-page-header">
    <div className="page-header-row">
      <div className="page-heading-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
    {tabs && tabs.length > 0 && <nav className="page-tabs" aria-label={`${title} views`}>
      {tabs.map(tab => <Link key={tab.href + tab.label} href={tab.href} aria-current={tab.active ? "page" : undefined}>{tab.label}</Link>)}
    </nav>}
  </header>;
}
