import Link from "next/link";
import { cn } from "@/lib/cn";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import type { LucideIcon } from "lucide-react";

type BaseProps = {
  icon: LucideIcon;
  label: string;
  description: string;
  tone?: "default" | "danger";
};

type ActionRowProps =
  | (BaseProps & { href: string; action?: undefined; hiddenFields?: undefined })
  | (BaseProps & {
      href?: undefined;
      action: (formData: FormData) => void | Promise<void>;
      hiddenFields?: Record<string, string>;
    })
  | (BaseProps & { href?: undefined; action?: undefined; hiddenFields?: undefined });

export function ActionRow(props: ActionRowProps) {
  const { icon: Icon, label, description, tone = "default" } = props;

  const classes = cn(
    "flex w-full cursor-pointer items-start gap-3.5 border-b border-line py-3.5 text-left last:border-b-0",
    tone === "danger" ? "text-danger" : "text-ink",
  );

  const content = (
    <>
      <Icon size={20} strokeWidth={1.8} aria-hidden className="mt-px shrink-0" />
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        <span className="text-xs leading-normal text-ink-soft">{description}</span>
      </span>
    </>
  );

  if (props.href) {
    return (
      <Link href={props.href} className={classes}>
        {content}
      </Link>
    );
  }

  if (props.action) {
    return (
      <form action={props.action}>
        {Object.entries(props.hiddenFields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <PendingSubmit className={classes}>{content}</PendingSubmit>
      </form>
    );
  }

  return (
    <button type="button" className={classes}>
      {content}
    </button>
  );
}
