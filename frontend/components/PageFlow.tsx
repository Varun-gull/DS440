"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { sectionIndex, sections } from "@/lib/sections";

type FlowDirection = "down" | "up";

type FlowValue = {
  /** Travel to a section, animating in the direction it sits in the running order. */
  travelTo: (href: string) => void;
  /** 0–1 charge on the overscroll gesture, for the "keep going" affordance. */
  charge: number;
  chargeDirection: FlowDirection;
  index: number;
  /** Direction of the current move, and whether the outgoing page is lifting. */
  direction: FlowDirection;
  leaving: boolean;
  pathname: string;
};

const FlowContext = createContext<FlowValue | null>(null);

export function usePageFlow() {
  const value = useContext(FlowContext);

  if (!value) {
    throw new Error("usePageFlow must be used inside PageFlow");
  }

  return value;
}

/** How much overscroll it takes to commit to the next section. */
const CHARGE_TO_COMMIT = 260;
/** Idle time after which a partial charge drains away. */
const CHARGE_DECAY_MS = 260;
/** Quiet period after a move, long enough to swallow trackpad momentum. */
const COOLDOWN_MS = 900;
/** Length of the outgoing lift before the route actually changes. */
const EXIT_MS = 170;

export function PageFlow({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [direction, setDirection] = useState<FlowDirection>("down");
  const [leaving, setLeaving] = useState(false);
  const [charge, setCharge] = useState(0);
  const [chargeDirection, setChargeDirection] = useState<FlowDirection>("down");

  const index = sectionIndex(pathname);
  const busyUntil = useRef(0);
  const travelled = useRef(false);
  const chargeRef = useRef(0);
  const chargeDirRef = useRef<FlowDirection>("down");
  const decayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The outgoing page is only lifted until the new route lands. A section we
  // travelled to always opens at its top; a Back navigation keeps whatever
  // position the browser restored.
  useEffect(() => {
    setLeaving(false);

    if (travelled.current) {
      travelled.current = false;
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [pathname]);

  const travel = useCallback(
    (href: string, nextDirection: FlowDirection) => {
      if (Date.now() < busyUntil.current) return;

      busyUntil.current = Date.now() + COOLDOWN_MS + EXIT_MS;
      travelled.current = true;
      chargeRef.current = 0;
      setCharge(0);
      setDirection(nextDirection);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }

      // Lift the outgoing page first, so the new one genuinely arrives from the
      // direction you travelled rather than cross-fading in place.
      setLeaving(true);
      window.setTimeout(() => router.push(href), EXIT_MS);
    },
    [router]
  );

  const travelTo = useCallback(
    (href: string) => {
      const target = sections.findIndex((section) => section.href === href);
      travel(href, target > index ? "down" : "up");
    },
    [index, travel]
  );

  /* --- Travel by scrolling past the end of a section --------------------- */
  useEffect(() => {
    if (index < 0) return;

    const previous = sections[index - 1];
    const next = sections[index + 1];

    function blocked() {
      if (document.querySelector('[data-blocks-flow="true"], [role="dialog"]')) return true;
      const active = document.activeElement;
      return active instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    }

    /** A wheel inside a list that can still scroll belongs to that list. */
    function overScrollableRegion(target: EventTarget | null, deltaY: number) {
      let node = target instanceof Element ? target : null;

      while (node && node !== document.body) {
        const style = getComputedStyle(node);

        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
          const room = deltaY > 0
            ? node.scrollHeight - node.clientHeight - node.scrollTop
            : node.scrollTop;

          if (room > 1) return true;
        }

        node = node.parentElement;
      }

      return false;
    }

    function atBottom() {
      return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    }

    function atTop() {
      return window.scrollY <= 1;
    }

    function drain() {
      if (decayTimer.current) clearTimeout(decayTimer.current);
      decayTimer.current = setTimeout(() => {
        chargeRef.current = 0;
        setCharge(0);
      }, CHARGE_DECAY_MS);
    }

    function release() {
      if (chargeRef.current === 0) return;
      chargeRef.current = 0;
      setCharge(0);
    }

    function push(amount: number, towards: FlowDirection) {
      const destination = towards === "down" ? next : previous;

      if (!destination || Date.now() < busyUntil.current) return;

      if (chargeDirRef.current !== towards) {
        chargeDirRef.current = towards;
        chargeRef.current = 0;
        setChargeDirection(towards);
      }

      chargeRef.current = Math.min(CHARGE_TO_COMMIT, chargeRef.current + amount);
      setCharge(chargeRef.current / CHARGE_TO_COMMIT);
      drain();

      if (chargeRef.current >= CHARGE_TO_COMMIT) {
        travel(destination.href, towards);
      }
    }

    function onWheel(event: WheelEvent) {
      if (blocked() || overScrollableRegion(event.target, event.deltaY)) return;

      if (event.deltaY > 0 && atBottom()) {
        push(event.deltaY, "down");
      } else if (event.deltaY < 0 && atTop()) {
        push(-event.deltaY, "up");
      } else {
        release();
      }
    }

    let touchY = 0;

    function onTouchStart(event: TouchEvent) {
      touchY = event.touches[0]?.clientY ?? 0;
    }

    function onTouchMove(event: TouchEvent) {
      if (blocked()) return;

      const y = event.touches[0]?.clientY ?? 0;
      const delta = touchY - y;
      touchY = y;

      if (overScrollableRegion(event.target, delta)) return;

      if (delta > 0 && atBottom()) {
        push(delta * 1.6, "down");
      } else if (delta < 0 && atTop()) {
        push(-delta * 1.6, "up");
      }
    }

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", release, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", release);
      if (decayTimer.current) clearTimeout(decayTimer.current);
    };
  }, [index, travel]);

  /* --- Scroll position flags used by the top bar and the dock ------------ */
  useEffect(() => {
    const root = document.documentElement;
    let queued = false;
    let lastY = window.scrollY;

    function sync() {
      if (queued) return;
      queued = true;
      window.setTimeout(() => {
        queued = false;
        const y = window.scrollY;
        const delta = y - lastY;

        root.dataset.scrolled = y > 8 ? "true" : "false";

        // Only commit to a direction once the move is deliberate, so the dock
        // does not flicker on small corrections.
        if (Math.abs(delta) > 12) {
          root.dataset.reading = delta > 0 && y > 220 ? "true" : "false";
          lastY = y;
        }
      }, 80);
    }

    sync();
    window.addEventListener("scroll", sync, { passive: true });

    return () => window.removeEventListener("scroll", sync);
  }, []);

  /* --- Sections below the fold arrive as you reach them ------------------ */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | null = null;

    // A timer rather than requestAnimationFrame: rAF is suspended while the
    // page is hidden, which would leave the reveal permanently unarmed.
    const timer = window.setTimeout(() => {
      const shell = document.querySelector("main.page-shell");

      if (!shell) return;

      /**
       * Pick reveal targets at a useful size. A block taller than most of the
       * viewport is really a list, so step inside and reveal its items instead
       * of one slab. Tables stay whole, since their children are rows.
       */
      function collect(parent: Element, depth: number): HTMLElement[] {
        const found: HTMLElement[] = [];

        for (const child of Array.from(parent.children)) {
          if (!(child instanceof HTMLElement)) continue;

          const isTable = /^(TABLE|THEAD|TBODY|TR)$/.test(child.tagName);
          const tall = child.getBoundingClientRect().height > window.innerHeight * 0.6;

          if (!isTable && depth < 2 && tall && child.children.length > 1) {
            found.push(...collect(child, depth + 1));
          } else {
            found.push(child);
          }
        }

        return found;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.target instanceof HTMLElement) {
              entry.target.dataset.reveal = "shown";
              observer?.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.04 }
      );

      const fold = window.innerHeight - 40;
      let staged = 0;

      for (const target of collect(shell, 0)) {
        // Already on screen at load: leave it to the boot sequence.
        if (target.getBoundingClientRect().top < fold) continue;

        target.dataset.reveal = "hidden";
        target.style.transitionDelay = `${Math.min(staged, 4) * 60}ms`;
        staged += 1;
        observer.observe(target);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [pathname]);

  const value = useMemo<FlowValue>(
    () => ({ travelTo, charge, chargeDirection, index, direction, leaving, pathname }),
    [travelTo, charge, chargeDirection, index, direction, leaving, pathname]
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

/**
 * The animated wrapper is kept separate from the provider on purpose: an
 * element that animates `translate` becomes the containing block for any
 * `position: fixed` descendant, which would nail the dock to the bottom of the
 * document instead of the viewport. Only the page body moves.
 */
export function PageBody({ children }: { children: ReactNode }) {
  const { direction, leaving, pathname, charge } = usePageFlow();

  return (
    // Two layers on purpose. The outer one fades with the gesture; the inner
    // one runs the arrival animation. Sharing a node would let the animation's
    // filled opacity overwrite the gesture fade.
    <div
      className="page-travel min-w-0"
      style={{ ["--travel" as string]: leaving ? 1 : charge }}
    >
      <div
        key={pathname}
        data-flow={direction}
        className={leaving ? "page-leaving min-w-0" : "page-arriving min-w-0"}
      >
        {children}
      </div>
    </div>
  );
}
