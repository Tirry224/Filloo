import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { deleteAccountAction } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfiles } from "@/lib/data/session";

/**
 * Confirmation de suppression, absente de la maquette : la suppression est
 * irréversible en pratique (anonymisation + bannissement), et redire les
 * conséquences avant le geste final coûte un tap.
 *
 * La garde ci-dessous est nécessaire : sans elle, cette page était la
 * SEULE de l'espace compte à s'afficher pour un visiteur non connecté, qui
 * lisait « Supprimer votre compte ? » et un bouton rouge sans avoir de
 * compte. Rien n'était détruisable — `deleteAccountAction` renvoie vers
 * /connexion faute de session — mais l'écran mentait sur l'état du
 * système, et l'échec n'arrivait qu'APRÈS le clic sur le bouton rouge.
 */
export default async function ConfirmDeleteAccountPage() {
  const supabase = await createClient();
  // Neutre au rôle : la suppression porte sur la CONNEXION entière
  // (anonymisation de tous les profils + bannissement de `auth.users`).
  // Exiger un profil client rendait l'écran inatteignable à un commerçant
  // qui n'en a pas.
  const profiles = await getMyProfiles(supabase);
  // `clientSpaceFallback` et non `landingForSession` : sans profil
  // utilisable, la personne n'est pas connectée — on l'envoie se
  // connecter, pas au catalogue.
  if (!profiles.some((p) => !p.isDeleted)) redirect(await clientSpaceFallback(supabase));

  return (
    <Sheet
      title="Supprimer votre compte ?"
      description="Votre nom et votre téléphone seront effacés. Vos conversations restent lisibles par vos interlocuteurs, sans votre identité. Si vous avez une boutique, vos produits seront retirés du catalogue. Cette action est irréversible."
      closeHref="/compte/informations"
      tone="danger"
    >
      <form action={deleteAccountAction}>
        <Button type="submit" variant="danger">
          Supprimer définitivement mon compte
        </Button>
      </form>
    </Sheet>
  );
}
