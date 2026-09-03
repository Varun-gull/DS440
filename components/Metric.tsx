"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * A number that ticks up to its value on mount, and re-ticks whenever the
 * value changes — so earning XP or sending an application reads as movement
 * rather than a silent swap. Renders the true value on the server, respects
 * reduced motion, and holds a fixed digit pitch so nothing reflows mid-count.
 */
export function Metric({
  value,
  className,
  duration = 900,
  delay = 220
}: {
  value: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const target = value;
    const from = isFirstRun.current ? 0 : fromRef.current;
    isFirstRun.current = false;

    function settle() {
      fromRef.current = target;
      setDisplay(target);
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // A hidden tab never runs animation frames, so counting up there would leave
    // a stale number on screen — show the real value instead.
    if (prefersReducedMotion || document.hidden || from === target || duration <= 0) {
      settle();
      return;
    }

    let frame = 0;
    let startedAt = 0;

    function step(now: number) {
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    }

    setDisplay(from);
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);

    // Whatever happens to the frame loop — backgrounded tab, throttled renderer —
    // the readout must end up on the true value.
    const safety = window.setTimeout(settle, delay + duration + 250);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(safety);
      cancelAnimationFrame(frame);
    };
  }, [value, duration, delay]);

  return <span className={clsx("metric", className)}>{display.toLocaleString()}</span>;
}
