"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When the route settles, hide the bar after a short finish delay
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden">
      <div className="h-full w-full animate-[loading_1.2s_ease-in-out_infinite] bg-sky" />
      <style>{`
        @keyframes loading {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
