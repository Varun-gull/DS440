"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { usePageFlow } from "@/components/PageFlow";
import { sections } from "@/lib/sections";

export function NavDock({ unreadMessages }: { unreadMessages: number }) {
  const { travelTo, charge, chargeDirection, index } = usePageFlow();

  const neighbour = chargeDirection === "down" ? sections[index + 1] : sections[index - 1];
  const showHint = charge > 0.04 && Boolean(neighbour);
  const Arrow = chargeDirection === "down" ? ChevronDown : ChevronUp;

  return (
    <div className="dock">
      {/* Rises above the dock as you push past the end of a section, so the
          gesture announces where it is going and can be abandoned part-way. */}
      <div className={clsx("dock-hint", showHint && "dock-hint-on")} aria-hidden={!showHint}>
        <Arrow size={15} className="shrink-0" />
        <span className="truncate">Keep going for {neighbour?.label}</span>
        <span className="dock-hint-track">
          <span className="dock-hint-fill" style={{ transform: `scaleX(${charge})` }} />
        </span>
      </div>

      <nav className="dock-shell" aria-label="Sections">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = index >= 0 && sections[index].href === section.href;
          const badge = section.href === "/messages" ? unreadMessages : 0;

          return (
            <Link
              key={section.href}
              href={section.href}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                travelTo(section.href);
              }}
              aria-current={active ? "page" : undefined}
              aria-label={section.label}
              title={section.label}
              className="dock-item"
            >
              <Icon size={24} className="shrink-0" aria-hidden />
              <span className="dock-label">{section.label}</span>
              {badge > 0 && (
                <span
                  className={clsx(
                    "metric absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ring-2 ring-white",
                    active ? "bg-white text-[#2A6384]" : "bg-[#2A6384] text-white"
                  )}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
