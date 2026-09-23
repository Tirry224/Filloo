import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

export function MenuList({ children }: { children: React.ReactNode }) {
  return <Card className="px-3.5">{children}</Card>;
}

export function MenuItem({
  icon: Icon,
  label,
  value,
  href,
  action,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  href?: string;
  action?: () => void | Promise<void>;
  tone?: "default" | "danger";
}) {
  const content = (
    <>
      <Icon size={20} strokeWidth={1.8} aria-hidden className="shrink-0" />
      <span className="flex-1 text-base">{label}</span>
      {value ? <span className="text-sm text-ink-soft">{value}</span> : null}
      {href ? (
        <ChevronRight size={18} strokeWidth={2} aria-hidden className="shrink-0 text-ink-soft" />
      ) : null}
    </>
  );

  const className = cn(
    "flex h-tap items-center gap-3.5 border-b border-line last:border-b-0",
    tone === "danger" ? "text-danger" : "text-ink",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (action) {
    return (
      <form action={action}>
        <button type="submit" className={cn(className, "w-full cursor-pointer text-left")}>
          {content}
        </button>
      </form>
    );
  }
  return <div className={cn(className, "text-ink-soft")}>{content}</div>;
}

export function MenuPanel({
  icon: Icon,
  label,
  title,
  children,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details data-panneau>
      <summary className="flex h-tap cursor-pointer list-none items-center gap-3.5 border-b border-line text-base text-ink last:border-b-0 [&::-webkit-details-marker]:hidden">
        <Icon size={20} strokeWidth={1.8} aria-hidden className="shrink-0" />
        <span className="flex-1">{label}</span>
      </summary>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[85vh] w-full max-w-app flex-col rounded-t-2xl border-t border-line bg-surface shadow-sheet sm:bottom-gutter sm:max-w-lecture sm:rounded-2xl sm:border">
        <p className="shrink-0 px-4.5 pt-3.5 pb-1 text-base font-bold">{title}</p>
        <div className="overflow-y-auto px-4.5 pt-3 pb-5">{children}</div>
      </div>
    </details>
  );
}
