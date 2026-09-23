import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-soft">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

const CONTROL = "w-full rounded-lg border border-line bg-surface px-3.5 text-base text-ink";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-control", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "resize-none py-3 leading-normal", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(CONTROL, "h-control appearance-none pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        strokeWidth={2}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-soft"
      />
    </div>
  );
}

export function FakeInput({
  children,
  className,
  trailing,
}: {
  children: React.ReactNode;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={cn(CONTROL, "h-control flex items-center gap-2.5", className)}>
      <span className="flex flex-1 items-center gap-2.5 truncate">{children}</span>
      {trailing}
    </div>
  );
}
