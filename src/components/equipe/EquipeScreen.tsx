import Link from "next/link";
import { Megaphone, SquarePen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { gardeEquipe } from "@/components/equipe/garde";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, lireMonFilEquipe } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";

/**
 * « Équipe Filloo » (0042) : les annonces reçues et le fil privé avec
 * l'équipe. Monté par deux routes, une par espace (`/compte/equipe`,
 * `/vendeur/equipe`) : même personne, même fil, seul le retour change.
 *
 * On écrit depuis le bouton en haut à droite, ou « Répondre » sous une
 * annonce : les deux mènent à l'écran d'écriture (`…/equipe/ecrire`),
 * pour que cette page reste une lecture (décision du 2026-11-05).
 * L'ouvrir marque tout comme lu.
 *
 * Après un envoi (`?envoye=1`) : message envoyé → retour → le fil →
 * retour → la page de compte. Le formulaire est REMPLACÉ dans l'historique
 * (`ecrireALEquipeAction`), il ne revient jamais par le retour.
 */
export async function EquipeScreen({
  espace,
  searchParams,
}: {
  espace: Espace;
  searchParams: Promise<{ envoye?: string }>;
}) {
  const { envoye } = await searchParams;
  const { supabase, user } = await gardeEquipe(espace);

  const chemin = CHEMINS_EQUIPE[espace];
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";
  const elements = await lireMonFilEquipe(supabase, user.id, espace);
  await Promise.all([
    supabase.rpc("marquer_annonces_lues", { p_espace: espace }),
    supabase.rpc("marquer_fil_equipe_lu", { p_espace: espace }),
  ]);

  return (
    <Screen largeur="rangees">
      <TopBar
        title="Équipe Filloo"
        /* Juste après un envoi, le retour mène d'abord au fil lui-même
           (sans le bandeau), puis seulement à la page de compte : le
           parcours attendu par le porteur du projet (2026-11-05). */
        backHref={envoye ? chemin : retour}
        right={
          <Link
            href={`${chemin}/ecrire`}
            className="-mr-1 flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent"
          >
            <SquarePen size={16} strokeWidth={2.2} aria-hidden />
            Écrire
          </Link>
        }
      />
      <ScreenBody className={elements.length ? "justify-end" : undefined}>
        {envoye ? (
          <div className="px-4 pt-4">
            <Notice tone="success">Message envoyé. L&apos;équipe vous répondra ici.</Notice>
          </div>
        ) : null}

        {elements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Les messages de l'équipe Filloo"
            description="Nos annonces arriveront ici. Une question, une idée, un problème ? Touchez « Écrire » en haut à droite : une personne de l'équipe vous répondra."
          />
        ) : (
          <div className="flex flex-col gap-2.5 p-4">
            {elements.map((e) =>
              e.type === "annonce" ? (
                <article key={`a-${e.id}`} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3.5">
                  <span className="flex items-center gap-1.5 text-2xs font-semibold text-accent-hover">
                    <Megaphone size={13} strokeWidth={2} aria-hidden />
                    Annonce de l&apos;équipe · {formatMessageTime(e.quand)}
                  </span>
                  <h2 className="text-base font-bold">{e.titre}</h2>
                  <p className="text-sm whitespace-pre-wrap text-ink">{e.texte}</p>
                  <Link
                    href={`${chemin}/ecrire?repondre=${e.id}`}
                    className="self-start pt-0.5 text-sm font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    Répondre
                  </Link>
                </article>
              ) : (
                <div key={`m-${e.id}`} className={cn("flex flex-col gap-1", e.deLEquipe ? "items-start" : "items-end")}>
                  {e.enReponseA ? (
                    <span className="flex max-w-[80%] items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-2xs font-medium text-accent-hover">
                      <Megaphone size={12} strokeWidth={2} aria-hidden />
                      <span className="truncate">En réponse à « {e.enReponseA} »</span>
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "flex max-w-[80%] flex-col gap-0.5 px-3 pt-2.5 pb-2",
                      e.deLEquipe
                        ? "rounded-lg rounded-bl-xs border border-line bg-surface"
                        : "rounded-lg rounded-br-xs bg-accent text-on-accent",
                    )}
                  >
                    <p className="text-base leading-normal whitespace-pre-wrap">{e.texte}</p>
                    <time className={cn("self-end text-2xs", e.deLEquipe ? "text-ink-soft" : "text-on-accent/75")}>
                      {e.deLEquipe ? "Équipe Filloo · " : ""}
                      {formatMessageTime(e.quand)}
                    </time>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}
