import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

export function SwitchSpaceCard({
  label,
  target,
  href,
}: {
  label: string;
  target: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-accent bg-accent-soft px-3.5 py-3.5"
    >
      <ArrowLeftRight size={20} strokeWidth={1.8} className="shrink-0 text-accent-hover" aria-hidden />
      <span className="flex flex-1 flex-col">
        <span className="text-base font-semibold text-accent-hover">{label}</span>
        <span className="text-sm text-ink-soft">{target}</span>
      </span>
    </Link>
  );
}
