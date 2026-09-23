import Link from "next/link";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong",
  ghost: "text-ink hover:bg-accent-soft",
  danger: "bg-surface text-danger border border-line hover:bg-danger-soft",
};

const SIZES: Record<Size, string> = {
  md: "h-control text-base",
  sm: "h-tap text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
};

type ButtonProps = CommonProps &
  ({ href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">
   | ({ href?: undefined } & Omit<React.ComponentProps<"button">, "className">));

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  fullWidth = true,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );

  const content = (
    <>
      {Icon ? <Icon size={20} strokeWidth={1.9} aria-hidden /> : null}
      {children}
    </>
  );

  if ("href" in props && props.href) {
    const { href, ...rest } = props as { href: string };
    return (
      <Link href={href} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...(props as React.ComponentProps<"button">)}>
      {content}
    </button>
  );
}
