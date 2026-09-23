import { cn } from "@/lib/cn";

export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-app flex-col bg-paper lg:border-x lg:border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ScreenBody({
  children,
  className,
  rangees = false,
}: {
  children: React.ReactNode;
  className?: string;
  rangees?: boolean;
}) {
  return (
    <main className={cn("flex flex-1 flex-col", rangees && "lg:max-w-2xl", className)}>
      {children}
    </main>
  );
}

export function ScreenFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 border-t border-line bg-surface px-4 pt-3 pb-4", className)}>
      {children}
    </div>
  );
}

export function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3 p-4", className)}>{children}</div>;
}
