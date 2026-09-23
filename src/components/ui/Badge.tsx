import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-paper text-ink-soft",
  accent: "bg-accent-soft text-accent-hover",
  success: "bg-success-soft text-success-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 self-start rounded-sm px-2 py-0.5",
        "text-2xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
