import Link from "next/link";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export function Chip({
  children,
  selected = false,
  icon: Icon,
  href,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  icon?: LucideIcon;
  href?: string;
  className?: string;
}) {
  const classes = cn(
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium",
    selected ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
    className,
  );

  const content = (
    <>
      {Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden /> : null}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}

export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5",
        "lg:mx-0 lg:flex-wrap lg:overflow-x-visible lg:px-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
