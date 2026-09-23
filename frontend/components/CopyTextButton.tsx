"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

export function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copyText} className="secondary-button">
      <Copy className="mr-2" size={18} /> {copied ? "Copied" : "Copy suggestion"}
    </button>
  );
}
