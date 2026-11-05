import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { repondreAuFilAction } from "@/lib/actions/equipe";
import { cn } from "@/lib/cn";
import { formatMessageTime } from "@/lib/format";
import { estUuid } from "@/lib/saisie";
import { createClient } from "@/lib/supabase/server";

/**
 * Le fil d'une personne avec l'équipe. L'ouvrir marque ses messages lus
 * pour TOUTE l'équipe : un seul collègue suffit à les prendre en charge.
 */
export default async function FilPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const [{ data: messages, error }, { data: membres }, { data: boite }] = await Promise.all([
    supabase
      .from("fil_equipe")
      .select("id, auteur_id, de_l_equipe, corps, created_at, annonces(titre)")
      .eq("fil_de", id)
      .order("created_at"),
    supabase.from("equipe").select("auth_user_id, nom"),
    supabase.rpc("boite_equipe"),
  ]);
  if (error) throw error;
  if (!messages.length) notFound();
  await supabase.rpc("marquer_fil_lu_par_l_equipe", { p_fil_de: id });

  const nomDe = new Map((membres ?? []).map((m) => [m.auth_user_id, m.nom]));
  const nom = boite?.find((f) => f.fil_de === id)?.nom ?? "Fil";

  return (
    <Screen largeur="colonne">
      <TopBar title={nom} backHref="/admin" />
      <ScreenBody>
        <Section>
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex flex-col", m.de_l_equipe ? "items-end" : "items-start")}>
                {m.annonces ? <p className="mb-1 text-xs text-ink-soft">En réponse à « {m.annonces.titre} »</p> : null}
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    m.de_l_equipe ? "bg-accent text-on-accent" : "border border-line bg-surface text-ink",
                  )}
                >
                  {m.corps}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {m.de_l_equipe ? `${(m.auteur_id && nomDe.get(m.auteur_id)) || "Équipe"} · ` : ""}
                  {formatMessageTime(m.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </Section>
        <Section>
          <form action={repondreAuFilAction} className="flex flex-col gap-3">
            <input type="hidden" name="filDe" value={id} />
            <Field label="Votre réponse" htmlFor="corps">
              <Textarea id="corps" name="corps" rows={4} maxLength={2000} required />
            </Field>
            <Notice>{erreur}</Notice>
            <Button type="submit">Répondre</Button>
          </form>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
