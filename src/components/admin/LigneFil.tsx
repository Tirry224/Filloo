import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { FilBoite } from "@/lib/data/equipe";
import { formatMessageTime } from "@/lib/format";

/** Un fil de la boîte, sur le modèle de `ThreadRow` de la messagerie. */
export function LigneFil({ fil }: { fil: FilBoite }) {
  const nonLu = fil.nonLus > 0;
  const aRepondre = !fil.dernierDeLEquipe;
  return (
    <Link
      href={`/admin/fil/${fil.filDe}?espace=${fil.espace}`}
      className="flex items-start gap-3 border-b border-line py-3.5 last:border-b-0"
    >
      <Avatar name={fil.nom} kind={fil.espace === "merchant" ? "shop" : "person"} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-base font-semibold">{fil.nom}</span>
            {/* Le même compte peut écrire des deux côtés (0044) : l'équipe voit d'où. */}
            <Badge tone={fil.espace === "merchant" ? "accent" : "neutral"} className="shrink-0 self-center">
              {fil.espace === "merchant" ? "Boutique" : "Client"}
            </Badge>
          </span>
          <time className="shrink-0 text-2xs text-ink-soft">{formatMessageTime(fil.dernierAt)}</time>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("flex-1 truncate text-sm", nonLu ? "font-semibold text-ink" : "text-ink-soft")}>
            {fil.dernierDeLEquipe ? "Équipe : " : ""}
            {fil.dernierCorps}
          </span>
          {nonLu ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-bold text-on-accent">
              {fil.nonLus}
            </span>
          ) : aRepondre ? (
            <Badge tone="warn" className="self-center">
              À répondre
            </Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
