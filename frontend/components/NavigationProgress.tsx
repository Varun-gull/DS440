"use client";

import { usePageFlow } from "@/components/PageFlow";

/**
 * Shown only while a route is actually resolving. Navigation now happens inside
 * a transition, so the previous page stays on screen the whole time — this is
 * the only signal that work is in flight, which makes it worth showing.
 */
export function NavigationProgress() {
  const { navigating } = usePageFlow();

  return (
    <div className="nav-progress" data-on={navigating ? "true" : undefined} aria-hidden>
      <span className="nav-progress-bar" />
    </div>
  );
}
