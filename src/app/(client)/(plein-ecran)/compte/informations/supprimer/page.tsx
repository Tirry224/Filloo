import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { deleteAccountAction } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfiles } from "@/lib/data/session";

export default async function ConfirmDeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; depuis?: string }>;
}) {
  const { erreur, depuis } = await searchParams;
  // Le bouton vit à côté de « Se déconnecter », dans les deux espaces :
  // fermer doit ramener là d'où l'on vient.
  const retour = depuis === "vendeur" ? "/vendeur/boutique" : "/compte";
  const supabase = await createClient();
  // Neutre au rôle : la suppression porte sur la CONNEXION entière, donc
  // exiger un profil client fermerait l'écran à un commerçant seul.
  const profiles = await getMyProfiles(supabase);
  if (!profiles.some((p) => !p.isDeleted)) redirect(await clientSpaceFallback(supabase));

  return (
    <Sheet
      title="Supprimer votre compte ?"
      description="Votre nom et votre téléphone seront effacés. Vos conversations restent lisibles par vos interlocuteurs, sans votre identité. Si vous avez une boutique, vos produits seront retirés du catalogue. Cette action est irréversible."
      closeHref={retour}
      tone="danger"
    >
      <Notice>{erreur}</Notice>
      <form action={deleteAccountAction}>
        <Button type="submit" variant="danger">
          Supprimer définitivement mon compte
        </Button>
      </form>
    </Sheet>
  );
}
