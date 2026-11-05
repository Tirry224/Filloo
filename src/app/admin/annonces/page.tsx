import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { publierAnnonceAction } from "@/lib/actions/equipe";
import { PUBLICS } from "@/lib/data/equipe";
import { formatMessageTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** Les 20 dernières suffisent à suivre ce qui est parti ; le reste est au tableau de bord. */
const DERNIERES = 20;

/**
 * Publier une annonce, et voir qui l'a lue. Seules les personnes inscrites
 * au moment de la publication la reçoivent (décision du 2026-11-05).
 */
export default async function AnnoncesPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const { data: annonces, error } = await supabase
    .from("annonces")
    .select("id, titre, corps, public, created_at, annonce_destinataires(lue_at)")
    .order("created_at", { ascending: false })
    .limit(DERNIERES);
  if (error) throw error;

  return (
    <Screen largeur="rangees">
      <TopBar title="Annonces" />
      <ScreenBody>
        <Section>
          <form action={publierAnnonceAction} className="flex flex-col gap-3">
            <Field label="Titre" htmlFor="titre" hint="Il s'affiche dans la notification.">
              <Input id="titre" name="titre" maxLength={80} required />
            </Field>
            <Field label="Texte" htmlFor="corps">
              <Textarea id="corps" name="corps" rows={5} maxLength={2000} required />
            </Field>
            <Field label="À qui" htmlFor="public">
              <Select id="public" name="public" defaultValue="tous">
                {Object.entries(PUBLICS).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </Select>
            </Field>
            <Notice>{erreur}</Notice>
            <Notice tone="success">{info}</Notice>
            <Button type="submit">Publier</Button>
          </form>
        </Section>
        <Section>
          <SectionLabel>Déjà publiées</SectionLabel>
          {annonces.length === 0 ? (
            <p className="text-sm text-ink-soft">Aucune annonce pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {annonces.map((a) => {
                const total = a.annonce_destinataires.length;
                const lues = a.annonce_destinataires.filter((d) => d.lue_at).length;
                return (
                  <li key={a.id}>
                    <Card>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-ink">{a.titre}</span>
                        <span className="shrink-0 text-xs text-ink-soft">{formatMessageTime(a.created_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink-soft">{a.corps}</p>
                      <p className="mt-2 text-xs text-ink-soft">
                        {PUBLICS[a.public]} · lue par {lues} sur {total}
                      </p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
