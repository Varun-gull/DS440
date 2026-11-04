"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function AuthSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="primary-button mt-1 w-full gap-2 disabled:cursor-wait disabled:opacity-60">
    {pending && <LoaderCircle size={17} className="animate-spin" aria-hidden />}
    {pending ? pendingLabel : label}
  </button>;
}
