import { BoiteVue } from "@/components/admin/BoiteVue";
import { lireBoite, monNomDansLEquipe } from "@/lib/data/equipe";
import { lireRecherche } from "@/lib/data/gestion";
import { getSessionUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

/**
 * La boîte de l'équipe : ce que les utilisateurs ont écrit, ce qui attend
 * une réponse d'abord. Un fil « à répondre » est un fil dont le dernier
 * message vient de la personne.
 */
export default async function BoitePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const recherche = lireRecherche((await searchParams).q);
  const supabase = await createClient();
  const [fils, user] = await Promise.all([lireBoite(supabase), getSessionUser(supabase)]);
  const nom = user ? await monNomDansLEquipe(supabase, user.id) : null;
  return <BoiteVue nom={nom} fils={fils} recherche={recherche} />;
}
