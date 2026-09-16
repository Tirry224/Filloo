import { Screen } from "@/components/ui/Screen";
import { ClientNav } from "@/components/nav/ClientNav";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * Le cadre des écrans CLIENT qui portent la barre d'onglets.
 *
 * PAS DE GARDE ICI, ET C'EST VOULU
 * Le pendant de ce fichier côté commerçant refuse l'entrée ; celui-ci ne
 * refuse personne, parce que le catalogue de Makiti est PUBLIC. `/`,
 * `/recherche` et `/boutique/[id]` se lisent sans compte — un visiteur
 * qui découvre l'application par un lien partagé doit voir des produits,
 * pas un formulaire de connexion. C'est une décision du projet, et la
 * symétrie serait ici une erreur.
 *
 * Les deux écrans de ce groupe qui exigent un compte — `/compte` et
 * `/messages` — le demandent eux-mêmes par `requireClientSpace`. La garde
 * est au bon niveau : sur les écrans qui en ont besoin, pas sur l'espace
 * entier.
 *
 * LE COMPTEUR N'EST DEMANDÉ QU'AUX PERSONNES CONNECTÉES
 * `countUnreadMessages` interroge la base. Le faire pour chaque visiteur
 * anonyme du catalogue serait une requête inutile sur chaque page vue, et
 * ce projet se mesure sur un réseau guinéen (docs/PERFORMANCE.md). On ne
 * la déclenche donc que si un profil client existe.
 */
export default async function ClientTabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase, "client");
  const unreadCount = profile ? await countUnreadMessages(supabase, "client") : 0;

  return (
    <Screen>
      {children}
      <ClientNav unreadCount={unreadCount} />
    </Screen>
  );
}
