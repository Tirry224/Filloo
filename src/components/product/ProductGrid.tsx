import { cn } from "@/lib/cn";

const GRILLE = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

export function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(GRILLE, className)}>{children}</div>;
}
