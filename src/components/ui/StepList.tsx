import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

export type StepState = "done" | "current" | "todo";

export function StepList({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="flex flex-col gap-3.5">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-6.5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              step.state === "done" && "bg-success text-on-accent",
              step.state === "current" && "bg-accent text-on-accent",
              step.state === "todo" && "border border-line text-ink-soft",
            )}
          >
            {step.state === "done" ? <Check size={14} strokeWidth={3} /> : null}
            {step.state === "current" ? <Clock size={14} strokeWidth={2.4} /> : null}
            {step.state === "todo" ? index + 1 : null}
          </span>
          <span
            className={cn(
              "text-base",
              step.state === "todo" ? "text-ink-soft" : "font-semibold text-ink",
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
