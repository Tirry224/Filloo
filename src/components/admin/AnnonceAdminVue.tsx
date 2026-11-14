import Link from "next/link";
import { CalendarClock, EyeOff, Send, Trash2, Undo2 } from "lucide-react";
import { ChoixPublic } from "@/components/admin/AnnoncesVue";
import { EtatAnnonce, demain, jour, jourEtHeure } from "@/components/admin/EtatAnnonce";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { changerEtatAnnonceAction, modifierAnnonceAction } from "@/lib/actions/equipe";
import { cn } from "@/lib/cn";
import { PUBLICS, type AnnonceAdmin, type Lecteur } from "@/lib/data/equipe";
import { TexteAvecLiens } from "@/components/ui/TexteAvecLiens";

/**
 * Une annonce, côté équipe (0045). Ce qu'on peut faire dépend de son état :
 * un brouillon se modifie, se publie, se programme ou se supprime ; une
 * programmée aussi, ou repasse en brouillon ; une publiée se corrige (sans
 * nouvelle notification) ou se retire ; une retirée se lit seulement.
 */
export function AnnonceAdminVue({
  annonce: a,
  lecteurs,
  erreur,
  info,
  onglet,
}: {
  annonce: AnnonceAdmin;
  lecteurs: Lecteur[];
  erreur?: string;
  info?: string;
  onglet: "oui" | "non";
}) {
  const modifiable = a.etat !== "retiree";
  const lues = lecteurs.filter((l) => l.lueAt);
  const nonLues = lecteurs.filter((l) => !l.lueAt);
  const part = lecteurs.length ? Math.round((lues.length / lecteurs.length) * 100) : 0;

  return (
    <TabScreen largeur="rangees">
      <TopBar title="Annonce" backHref="/admin/annonces" right={<EtatAnnonce etat={a.etat} />} />
      <ScreenBody>
        <Section className="gap-5">
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          <Card className="flex flex-col gap-1.5 p-4 text-sm">
            <Historique libelle="Destinataires" valeur={PUBLICS[a.public]} />
            <Historique libelle="Créée" valeur={`${jourEtHeure(a.creeeAt)}${a.auteur ? ` par ${a.auteur}` : ""}`} />
            {a.programmeePour ? <Historique libelle="Programmée" valeur={`${jour(a.programmeePour)}, vers 7 h`} /> : null}
            {a.publieeAt ? <Historique libelle="Publiée" valeur={jourEtHeure(a.publieeAt)} /> : null}
            {a.modifieeAt ? (
              <Historique libelle="Modifiée" valeur={`${jourEtHeure(a.modifieeAt)}${a.modifieePar ? ` par ${a.modifieePar}` : ""}`} />
            ) : null}
            {a.retireeAt ? (
              <Historique libelle="Retirée" valeur={`${jourEtHeure(a.retireeAt)}${a.retireePar ? ` par ${a.retireePar}` : ""}`} />
            ) : null}
          </Card>

          {modifiable ? (
            <Card padded>
              <form action={modifierAnnonceAction} className="flex flex-col gap-4">
                <input type="hidden" name="id" value={a.id} />
                <h2 className="text-base font-bold">{a.etat === "publiee" ? "Corriger l'annonce" : "Modifier l'annonce"}</h2>
                <Field label="Titre" htmlFor="titre">
                  <Input id="titre" name="titre" maxLength={80} required defaultValue={a.titre} />
                </Field>
                <Field label="Message" htmlFor="corps">
                  <Textarea id="corps" name="corps" rows={6} maxLength={2000} required defaultValue={a.corps} />
                </Field>
                <ChoixPublic valeur={a.public} fige={a.etat === "publiee"} />
                {a.etat === "publiee" ? (
                  <p className="text-xs text-ink-soft">
                    Les destinataires voient la nouvelle version avec la mention « Modifiée ». Aucune nouvelle notification
                    n&apos;est envoyée.
                  </p>
                ) : null}
                <Button type="submit" variant="secondary">
                  Enregistrer les modifications
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="flex flex-col gap-2 p-4">
              <h2 className="text-lg font-bold">{a.titre}</h2>
              <p className="text-base whitespace-pre-wrap"><TexteAvecLiens texte={a.corps} /></p>
            </Card>
          )}

          {a.etat === "brouillon" || a.etat === "programmee" ? (
            <Card padded className="flex flex-col gap-3">
              <h2 className="text-base font-bold">Publication</h2>
              <ActionEtat id={a.id} action="publier" icone={Send} libelle="Publier maintenant" principal />
              <form action={changerEtatAnnonceAction} className="flex items-stretch gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="action" value="programmer" />
                <label className="sr-only" htmlFor="date">
                  Date de publication
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  min={demain()}
                  defaultValue={a.programmeePour ?? demain()}
                  className="h-tap min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
                />
                <button
                  type="submit"
                  className="flex h-tap shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-base font-semibold"
                >
                  <CalendarClock size={18} strokeWidth={2} aria-hidden />
                  {a.etat === "programmee" ? "Changer la date" : "Programmer"}
                </button>
              </form>
              {a.etat === "programmee" ? (
                <ActionEtat id={a.id} action="brouillon" icone={Undo2} libelle="Annuler la programmation" />
              ) : null}
              <Confirmer
                id={a.id}
                action="supprimer"
                icone={Trash2}
                libelle="Supprimer"
                question="Supprimer définitivement cette annonce ? Elle n'a jamais été publiée."
              />
            </Card>
          ) : null}

          {a.etat === "publiee" ? (
            <Confirmer
              id={a.id}
              action="retirer"
              icone={EyeOff}
              libelle="Retirer l'annonce"
              question="Retirer cette annonce ? Elle disparaîtra chez tous ses destinataires. Elle restera ici, marquée « Retirée »."
            />
          ) : null}

          {a.etat === "publiee" || a.etat === "retiree" ? (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Qui l&apos;a lue</SectionLabel>
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-soft">Lue par</span>
                  <span className="font-semibold tabular-nums">
                    {lues.length} sur {lecteurs.length} · {part} %
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${part}%` }} />
                </div>
              </Card>
              <nav aria-label="Lecteurs" className="inline-flex self-start rounded-full border border-line bg-surface p-1">
                {(
                  [
                    ["oui", `Lue · ${lues.length}`],
                    ["non", `Pas encore · ${nonLues.length}`],
                  ] as const
                ).map(([cle, libelle]) => (
                  <Link
                    key={cle}
                    href={`/admin/annonces/${a.id}?lecteurs=${cle}`}
                    replace
                    scroll={false}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                      onglet === cle ? "bg-accent text-on-accent" : "text-ink-soft",
                    )}
                  >
                    {libelle}
                  </Link>
                ))}
              </nav>
              <Card className="px-4">
                {(onglet === "oui" ? lues : nonLues).length === 0 ? (
                  <p className="py-3.5 text-sm text-ink-soft">
                    {onglet === "oui" ? "Personne ne l'a encore lue." : "Tout le monde l'a lue."}
                  </p>
                ) : (
                  (onglet === "oui" ? lues : nonLues).map((l) => (
                    <div key={l.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                      <Avatar name={l.nom} size={32} />
                      <span className="flex-1 truncate text-sm">{l.nom}</span>
                      {l.lueAt ? <span className="text-2xs text-ink-soft">{jourEtHeure(l.lueAt)}</span> : null}
                    </div>
                  ))
                )}
              </Card>
            </div>
          ) : null}
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}

function Historique({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-ink-soft">{libelle}</span>
      <span className="min-w-0 flex-1">{valeur}</span>
    </div>
  );
}

type Icone = React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;

function ActionEtat({
  id,
  action,
  icone: I,
  libelle,
  principal = false,
}: {
  id: string;
  action: string;
  icone: Icone;
  libelle: string;
  principal?: boolean;
}) {
  return (
    <form action={changerEtatAnnonceAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className={cn(
          "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg text-base font-semibold",
          principal ? "h-control bg-accent text-on-accent" : "h-tap border border-line bg-surface text-ink",
        )}
      >
        <I size={18} strokeWidth={2} aria-hidden />
        {libelle}
      </button>
    </form>
  );
}

/** Une action qui ne se rattrape pas : un premier appui ouvre la question, le second confirme. */
function Confirmer({ id, action, icone: I, libelle, question }: { id: string; action: string; icone: Icone; libelle: string; question: string }) {
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex h-tap cursor-pointer list-none items-center justify-center gap-2 text-base font-semibold text-danger [&::-webkit-details-marker]:hidden">
        <I size={18} strokeWidth={2} aria-hidden />
        {libelle}
      </summary>
      <form action={changerEtatAnnonceAction} className="flex flex-col gap-3 border-t border-line p-3.5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value={action} />
        <p className="text-sm">{question}</p>
        <button
          type="submit"
          className="flex h-tap w-full cursor-pointer items-center justify-center rounded-lg bg-danger text-base font-semibold text-on-accent"
        >
          Oui, {libelle.toLowerCase()}
        </button>
      </form>
    </details>
  );
}
