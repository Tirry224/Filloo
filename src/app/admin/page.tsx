import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { formatMessageTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** La boîte de l'équipe : un fil par personne, le plus récent d'abord. */
export default async function BoitePage() {
  const supabase = await createClient();
  const { data: fils, error } = await supabase.rpc("boite_equipe");
  if (error) throw error;

  return (
    <Screen largeur="rangees">
      <TopBar title="Boîte Filloo" />
      <ScreenBody>
        <Section>
          {fils.length === 0 ? (
            <p className="text-sm text-ink-soft">Personne n&apos;a encore écrit à l&apos;équipe.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fils.map((f) => (
                <li key={f.fil_de}>
                  <Link href={`/admin/fil/${f.fil_de}`} className="block">
                    <Card>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-ink">{f.nom}</span>
                        <span className="shrink-0 text-xs text-ink-soft">{formatMessageTime(f.dernier_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                        {f.dernier_de_l_equipe ? "Équipe : " : ""}
                        {f.dernier_corps}
                      </p>
                      {f.non_lus > 0 ? (
                        <p className="mt-2 text-xs font-semibold text-accent">{f.non_lus} non lu(s)</p>
                      ) : !f.dernier_de_l_equipe ? (
                        <p className="mt-2 text-xs font-semibold text-ink">En attente de réponse</p>
                      ) : null}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
