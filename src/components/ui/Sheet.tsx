import Link from "next/link";
import { cn } from "@/lib/cn";

export function Sheet({
  title,
  description,
  children,
  closeHref,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  closeHref: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="fixed inset-0 flex flex-col justify-end">
      <Link href={closeHref} aria-label="Fermer" className="absolute inset-0 bg-overlay" />
      <div className="relative mx-auto w-full max-w-app rounded-t-2xl bg-surface px-4.5 pt-2.5 pb-5 shadow-sheet">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />
        <h1 className={cn("text-xl font-bold", tone === "danger" && "text-danger")}>{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3.5">{children}</div>
      </div>
    </div>
  );
}
