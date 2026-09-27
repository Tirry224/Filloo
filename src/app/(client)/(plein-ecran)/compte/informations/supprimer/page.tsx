import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
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
  // Des profils TOUS supprimés restent admis : une connexion encore
  // ouverte dans cet état est une suppression interrompue avant le
  // bannissement, qui doit pouvoir être relancée — la fermer ici laissait
  // la personne connectée, son email bloqué, sans chemin pour finir.
  const profiles = await getMyProfiles(supabase);
  if (profiles.length === 0) redirect(await clientSpaceFallback(supabase));

  return (
    <Sheet
      title="Supprimer votre compte ?"
      description="Votre nom et votre téléphone seront effacés. Vos conversations restent lisibles par vos interlocuteurs, sans votre identité. Si vous avez une boutique, vos produits seront retirés du catalogue et ses coordonnées effacées. Cette action est irréversible."
      closeHref={retour}
      tone="danger"
    >
      <Notice>{erreur}</Notice>
      <form action={deleteAccountAction} className="space-y-4">
        <Field label="Mot de passe" htmlFor="currentPassword" hint="Il confirme que c'est bien vous.">
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            required
          />
        </Field>
        <Button type="submit" variant="danger">
          Supprimer définitivement mon compte
        </Button>
      </form>
    </Sheet>
  );
}
