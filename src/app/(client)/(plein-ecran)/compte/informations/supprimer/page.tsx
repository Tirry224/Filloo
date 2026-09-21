import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { deleteAccountAction } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfiles } from "@/lib/data/session";

/**
 * Confirmation de suppression, absente de la maquette : le geste est
 * irréversible en pratique (anonymisation + bannissement), et redire les
 * conséquences avant coûte un tap.
 *
 * Sans la garde ci-dessous, un visiteur non connecté lit « Supprimer votre
 * compte ? » et un bouton rouge : rien n'est détruisable, mais l'écran
 * ment sur l'état du système et l'échec n'arrive qu'après le clic.
 */
export default async function ConfirmDeleteAccountPage() {
  const supabase = await createClient();
  // Neutre au rôle : la suppression porte sur la CONNEXION entière, donc
  // exiger un profil client fermerait l'écran à un commerçant seul.
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
