import { cn } from "@/lib/cn";

export function AppShell({
  nav,
  children,
  className,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-app flex-col bg-paper md:max-w-2xl",
        "md:border-x md:border-line lg:max-w-wide lg:flex-row",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {nav}
    </div>
  );
}
