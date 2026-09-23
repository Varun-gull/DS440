"use client";

import { Loader2, Send } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { sendPeerMessage } from "@/lib/messages/actions";

type Props = {
  recipientId: string;
  applicationId: string;
  roleKey: string;
  sourceMessageId: string;
  defaultSubject: string;
  returnTo: string;
};

export function MessageReplyForm({ recipientId, applicationId, roleKey, sourceMessageId, defaultSubject, returnTo }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = bodyRef.current?.value.trim() ?? "";
    if (!body) { setError("Write a message before sending."); return; }

    startTransition(async () => {
      await sendPeerMessage(fd);
      if (bodyRef.current) bodyRef.current.value = "";
    });
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white/90 p-4">
      <input type="hidden" name="recipientId" value={recipientId} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="roleKey" value={roleKey} />
      <input type="hidden" name="sourceMessageId" value={sourceMessageId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="subject" value={defaultSubject} />
      <div className="grid gap-3">
        {error && <p className="text-xs font-bold text-red-500">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <textarea
            ref={bodyRef}
            name="body"
            rows={2}
            className="field min-h-20 flex-1 text-sm"
            placeholder="Write a reply..."
          />
          <button type="submit" disabled={isPending} className="primary-button self-end disabled:opacity-70">
            {isPending
              ? <><Loader2 className="mr-2 animate-spin" size={16} /> Sending…</>
              : <><Send className="mr-2" size={16} /> Send</>
            }
          </button>
        </div>
      </div>
    </form>
  );
}
