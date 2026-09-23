"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

export function PendingSubmit({ className, children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(className, "disabled:cursor-wait disabled:opacity-50")}
    >
      {children}
      {pending ? <span className="ml-auto self-center text-xs text-ink-soft">En cours…</span> : null}
    </button>
  );
}
