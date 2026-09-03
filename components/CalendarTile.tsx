"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function getCalendarParts() {
  const now = new Date();
  return {
    month: MONTH_ABBR[now.getMonth()],
    day: now.getDate(),
  };
}

export function CalendarTile() {
  const [parts, setParts] = useState<{ month: string; day: number } | null>(null);

  useEffect(() => {
    setParts(getCalendarParts());
  }, []);

  return (
    <Link
      href="/calendar"
      className="relative hidden h-11 w-11 select-none flex-col items-center justify-center gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2A6384]/50 hover:shadow-md sm:flex"
      aria-label="Calendar"
      suppressHydrationWarning
    >
      <span className="absolute left-0 right-0 top-0 flex h-[16px] items-center justify-center bg-[#2A6384]">
        <span className="text-[8px] font-semibold uppercase leading-none tracking-wide text-white">{parts?.month ?? "CAL"}</span>
      </span>
      <span className="metric relative mt-3 text-[15px] font-bold leading-none">{parts?.day ?? ""}</span>
    </Link>
  );
}
