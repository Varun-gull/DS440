"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import type { ReactNode } from "react";
import { sectionIndex } from "@/lib/sections";

type FlowValue = { travelTo: (href: string) => void; charge: number; chargeDirection: "down" | "up"; index: number; direction: "down" | "up"; pathname: string; pendingHref: string | null; navigating: boolean };
const FlowContext = createContext<FlowValue | null>(null);
export function usePageFlow() {
  const value = useContext(FlowContext);
  if (!value) throw new Error("usePageFlow must be used inside PageFlow");
  return value;
}

// Navigation happens only through an explicit link. Scrolling never changes pages
// or discards a form, a chat, or an interview in progress.
export function PageFlow({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const travelTo = useCallback((href: string) => startNavigation(() => router.push(href)), [router]);
  const value = useMemo<FlowValue>(() => ({ travelTo, charge: 0, chargeDirection: "down", index: sectionIndex(pathname), direction: "down", pathname, pendingHref: null, navigating }), [travelTo, pathname, navigating]);
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="workspace-content" id="workspace-content">{children}</div>;
}
