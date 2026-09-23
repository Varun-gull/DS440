"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Submit control for server-action forms. While the action is in flight the
 * label is replaced by a spinner, so a save never looks like a dead click.
 * Must be rendered inside the <form> whose status it reports on.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  title
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      title={title}
      aria-busy={pending || undefined}
      className={clsx(className, pending && "cursor-progress")}
    >
      {pending ? (
        <>
          <Loader2 className="mr-1 animate-spin" size={14} aria-hidden />
          {pendingLabel ?? "Saving"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
