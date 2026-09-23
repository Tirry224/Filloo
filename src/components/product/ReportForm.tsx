"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { reportProductAction } from "@/lib/actions/messages";
import type { ActionState } from "@/lib/actions/auth";

export function ReportForm({ productId, reasons }: { productId: string; reasons: string[] }) {
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(reportProductAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="productId" value={productId} />
      <div>
        {reasons.map((reason, index) => (
          <label
            key={reason}
            className="flex min-h-tap cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0"
          >
            <input
              type="radio"
              name="reason"
              value={reason}
              defaultChecked={index === 0}
              required
              className="size-5 accent-accent"
            />
            <span className="text-base">{reason}</span>
          </label>
        ))}
      </div>
      <Textarea name="details" rows={3} placeholder="Précisez si besoin (facultatif)…" aria-label="Précisions" />
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer le signalement"}
      </Button>
    </form>
  );
}
