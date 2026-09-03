"use client";

import { useEffect } from "react";
import { markPeerMessageRead } from "@/lib/messages/actions";

export function AutoMarkRead({ messageId, returnTo }: { messageId: string; returnTo: string }) {
  useEffect(() => {
    if (!messageId) return;
    const fd = new FormData();
    fd.set("messageId", messageId);
    fd.set("returnTo", returnTo);
    markPeerMessageRead(fd).catch(() => {});
  }, [messageId, returnTo]);

  return null;
}
