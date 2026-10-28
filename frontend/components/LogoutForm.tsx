"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";
import { logOut } from "@/lib/auth/actions";

function LogoutButton({ variant }: { variant: "menu" | "secondary" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={variant === "menu"
        ? "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-rose-600 transition duration-150 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
        : "secondary-button w-full disabled:cursor-wait disabled:opacity-60"}
    >
      {variant === "menu" && (pending ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />)}
      {pending ? "Logging out…" : variant === "menu" ? "Log out" : "Sign out"}
    </button>
  );
}

export function LogoutForm({ variant = "secondary", className }: { variant?: "menu" | "secondary"; className?: string }) {
  const [state, formAction] = useFormState(logOut, { error: "" });

  return (
    <form action={formAction} className={className}>
      <LogoutButton variant={variant} />
      {state.error && <p role="alert" className="px-4 py-2 text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}
