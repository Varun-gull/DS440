"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyInviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mt-4 grid gap-2">
      <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 text-sm font-bold text-slate-700">
        {url}
      </div>
      <button type="button" onClick={copyLink} className="secondary-button w-full">
        {copied ? <Check className="mr-2" size={18} /> : <Copy className="mr-2" size={18} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
