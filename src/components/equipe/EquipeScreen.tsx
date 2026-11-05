import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ecrireALEquipeAction } from "@/lib/actions/equipe";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, lireMonFilEquipe } from "@/lib/data/equipe";
import { clientSpaceFallback, getMyProfile, getSessionUser } from "@/lib/data/session";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";
import { estUuid } from "@/lib/saisie";
import { createClient } from "@/lib/supabase/server";

/**
 * « Équipe Filloo » (0042) : les annonces reçues et le fil privé avec
 * l'équipe, sur un seul écran. Monté par deux routes, une par espace
 * (`/compte/equipe`, `/vendeur/equipe`) : c'est la même personne et le
 * même fil des deux côtés, seul le chemin de retour change.
 *
 * L'ouvrir marque tout comme lu. « Répondre » sous une annonce passe
 * l'annonce dans l'URL (`?repondre=`) : la base vérifie qu'elle m'était
 * bien destinée.
 */
export async function EquipeScreen({
  espace,
  searchParams,
}: {
  espace: Espace;
  searchParams: Promise<{ erreur?: string; repondre?: string }>;
}) {
  const { erreur, repondre } = await searchParams;
  const supabase = await createClient();

  // L'espace commerçant est gardé par son layout ; le client, non.
  if (espace === "client") {
    const client = await getMyProfile(supabase, "client");
    if (!client) redirect(await clientSpaceFallback(supabase));
    if (client.isSuspended) redirect("/compte/suspendu");
  }
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");

  const chemin = CHEMINS_EQUIPE[espace];
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";
  const elements = await lireMonFilEquipe(supabase, user.id);
  await Promise.all([supabase.rpc("marquer_annonces_lues"), supabase.rpc("marquer_fil_equipe_lu")]);

  const annonceCitee = estUuid(repondre)
    ? elements.find((e) => e.type === "annonce" && e.id === repondre)
    : undefined;

  return (
    <Screen>
      <TopBar title="Équipe Filloo" backHref={retour} />
      <ScreenBody>
        <Section className="gap-3">
          {elements.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Aucune annonce pour l&apos;instant. Une question, une idée, un problème ? Écrivez-nous ci-dessous : une
              personne de l&apos;équipe vous répondra.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {elements.map((e) =>
                e.type === "annonce" ? (
                  <li key={`a-${e.id}`} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3.5">
                    <span className="text-xs font-semibold text-ink-soft">Annonce · {formatMessageTime(e.quand)}</span>
                    <span className="font-bold text-ink">{e.titre}</span>
                    <p className="whitespace-pre-wrap text-sm text-ink">{e.texte}</p>
                    <Link
                      href={`${chemin}?repondre=${e.id}#reponse`}
                      className="self-start text-sm font-semibold text-accent underline-offset-2 hover:underline"
                    >
                      Répondre
                    </Link>
                  </li>
                ) : (
                  <li key={`m-${e.id}`} className={cn("flex flex-col", e.deLEquipe ? "items-start" : "items-end")}>
                    {e.enReponseA ? <span className="mb-1 text-xs text-ink-soft">En réponse à « {e.enReponseA} »</span> : null}
                    <p
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                        e.deLEquipe ? "border border-line bg-surface text-ink" : "bg-accent text-on-accent",
                      )}
                    >
                      {e.texte}
                    </p>
                    <span className="mt-1 text-xs text-ink-soft">
                      {e.deLEquipe ? "Équipe Filloo · " : ""}
                      {formatMessageTime(e.quand)}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </Section>

        <Section>
          <form id="reponse" action={ecrireALEquipeAction} className="flex flex-col gap-3">
            <input type="hidden" name="espace" value={espace} />
            {annonceCitee ? <input type="hidden" name="annonceId" value={annonceCitee.id} /> : null}
            {annonceCitee && annonceCitee.type === "annonce" ? (
              <p className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
                <span className="truncate">
                  En réponse à : <strong>{annonceCitee.titre}</strong>
                </span>
                <Link href={chemin} className="shrink-0 text-ink-soft underline underline-offset-2">
                  Retirer
                </Link>
              </p>
            ) : null}
            <Field label="Écrire à l'équipe" htmlFor="corps">
              <Textarea id="corps" name="corps" rows={4} maxLength={2000} required />
            </Field>
            <Notice>{erreur}</Notice>
            <Button type="submit">Envoyer</Button>
          </form>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
