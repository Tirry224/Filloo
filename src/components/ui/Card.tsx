import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  padded = false,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-surface",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
