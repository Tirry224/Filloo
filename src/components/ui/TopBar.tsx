import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function TopBar({
  title,
  backHref,
  right,
  className,
}: {
  title?: React.ReactNode;
  backHref?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-3.5",
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Retour"
          className="-m-2 flex size-tap items-center justify-center text-ink-soft"
        >
          <ArrowLeft size={22} strokeWidth={2} aria-hidden />
        </Link>
      ) : null}
      {typeof title === "string" ? (
        <h1 className="text-lg font-bold">{title}</h1>
      ) : (
        title
      )}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </header>
  );
}

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "font-display font-extrabold tracking-tight text-accent",
        size === "lg" ? "text-2xl" : "text-xl",
      )}
    >
      Filloo
    </span>
  );
}
