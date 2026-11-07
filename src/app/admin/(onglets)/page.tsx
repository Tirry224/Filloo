import { BoiteVue } from "@/components/admin/BoiteVue";
import { lireBoite, monNomDansLEquipe } from "@/lib/data/equipe";
import { lireComptesTous, lireRecherche } from "@/lib/data/gestion";
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
  const [fils, user, comptes] = await Promise.all([
    lireBoite(supabase),
    getSessionUser(supabase),
    // Chercher quelqu'un, c'est aussi pouvoir lui écrire en premier.
    recherche ? lireComptesTous(supabase, recherche) : Promise.resolve([]),
  ]);
  const nom = user ? await monNomDansLEquipe(supabase, user.id) : null;
  /* Ceux qui ont déjà un fil y sont listés : on ne les répète pas. */
  const avecFil = new Set(fils.map((f) => `${f.filDe}-${f.espace}`));
  const sansFil = comptes.filter((c) => !c.is_deleted && !avecFil.has(`${c.auth_user_id}-${c.role}`));
  return <BoiteVue nom={nom} fils={fils} recherche={recherche} sansFil={sansFil} />;
}
