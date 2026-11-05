import { Megaphone, Send } from "lucide-react";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { publierAnnonceAction } from "@/lib/actions/equipe";
import { PUBLICS } from "@/lib/data/equipe";
import { formatMessageTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

/** Les choix du formulaire : un mot chacun, la précision dessous. */
const CHOIX_PUBLIC = {
  tous: { libelle: "Tous", aide: "Clients et commerçants" },
  clients: { libelle: "Clients", aide: "Comptes clients" },
  commercants: { libelle: "Commerçants", aide: "Comptes boutique" },
} as const;

export type AnnoncePubliee = {
  id: string;
  titre: string;
  corps: string;
  public: Database["public"]["Enums"]["public_annonce"];
  created_at: string;
  annonce_destinataires: { lue_at: string | null }[];
};

/** Les annonces, affichage seul (données lues par `admin/(onglets)/annonces/page.tsx`). */
export function AnnoncesVue({ annonces, erreur, info }: { annonces: AnnoncePubliee[]; erreur?: string; info?: string }) {
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet
            titre="Annonces"
            sousTitre="Un message de l'équipe à tous, aux clients ou aux commerçants, avec une notification."
          />

          <Card padded>
            <form action={publierAnnonceAction} className="flex flex-col gap-4">
              <Field label="Titre" htmlFor="titre" hint="C'est lui qui s'affiche dans la notification.">
                <Input id="titre" name="titre" maxLength={80} required placeholder="Ex. : Nouvelle catégorie Beauté" />
              </Field>
              <Field label="Message" htmlFor="corps">
                <Textarea id="corps" name="corps" rows={5} maxLength={2000} required placeholder="Ce que vous voulez dire…" />
              </Field>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Destinataires</legend>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(CHOIX_PUBLIC).map(([valeur, { libelle, aide }]) => (
                    <label key={valeur} className="cursor-pointer">
                      <input type="radio" name="public" value={valeur} defaultChecked={valeur === "tous"} className="peer sr-only" />
                      <span className="flex h-full flex-col gap-0.5 rounded-lg border border-line bg-surface px-2.5 py-2.5 peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:shadow-focus">
                        <span className="text-sm font-semibold">{libelle}</span>
                        <span className="text-2xs text-ink-soft">{aide}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-ink-soft">Seules les personnes déjà inscrites la recevront.</p>
              </fieldset>
              {erreur ? <Notice>{erreur}</Notice> : null}
              {info ? <Notice tone="success">{info}</Notice> : null}
              <Button type="submit" icon={Send}>
                Publier l&apos;annonce
              </Button>
            </form>
          </Card>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Déjà publiées</SectionLabel>
            {annonces.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="Aucune annonce"
                description="La première que vous publierez apparaîtra ici, avec le nombre de personnes qui l'ont lue."
              />
            ) : (
              annonces.map((a) => {
                const total = a.annonce_destinataires.length;
                const lues = a.annonce_destinataires.filter((d) => d.lue_at).length;
                const part = total ? Math.round((lues / total) * 100) : 0;
                return (
                  <Card key={a.id} className="flex flex-col gap-2 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone="accent">{PUBLICS[a.public]}</Badge>
                      <time className="text-2xs text-ink-soft">{formatMessageTime(a.created_at)}</time>
                    </div>
                    <span className="text-base font-semibold">{a.titre}</span>
                    <p className="line-clamp-3 text-sm whitespace-pre-wrap text-ink-soft">{a.corps}</p>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-ink-soft">Lue par</span>
                        <span className="font-semibold tabular-nums">
                          {lues} sur {total} · {part} %
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
                        <div className="h-full rounded-full bg-accent" style={{ width: `${part}%` }} />
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
