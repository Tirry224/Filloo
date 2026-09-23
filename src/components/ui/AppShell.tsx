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
        "mx-auto flex min-h-dvh w-full max-w-wide flex-col bg-paper",
        "wide:border-x wide:border-line lg:flex-row",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {nav}
    </div>
  );
}
