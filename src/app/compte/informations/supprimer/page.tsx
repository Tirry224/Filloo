import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { deleteAccountAction } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile } from "@/lib/data/session";

/**
 * Confirmation de suppression — la maquette n'avait qu'un bouton direct,
 * sans étape intermédiaire. Une suppression de compte reste irréversible
 * en pratique (anonymisation + bannissement) : une feuille qui redit les
 * conséquences avant le geste final coûte un tap, pas plus, et évite un
 * clic accidentel sur une action qu'on ne peut pas défaire.
 *
 * La garde d'accès a été ajoutée le 2026-09-13, après avoir ouvert
 * l'adresse sans session dans un navigateur : cette page était la SEULE
 * de l'espace compte à s'afficher pour un visiteur non connecté, qui
 * lisait donc « Supprimer votre compte ? » et un bouton rouge sans avoir
 * de compte. Rien n'était détruisable — `deleteAccountAction` renvoie
 * vers /connexion faute de session — mais une action irréversible
 * proposée à quelqu'un qui n'y a pas droit est un écran qui ment sur
 * l'état du système, et l'échec n'arrivait qu'APRÈS le clic sur le
 * bouton rouge.
 */
export default async function ConfirmDeleteAccountPage() {
  const supabase = await createClient();
  const profile = await getMyProfile(supabase, "client");
  if (!profile) redirect(await clientSpaceFallback(supabase));

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
