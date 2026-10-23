import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Sheet } from "@/components/ui/Sheet";
import { deleteClientAccountAction, deleteMerchantAccountAction } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyDeletedRoles, getMyProfiles } from "@/lib/data/session";
import type { Espace } from "@/lib/espace";

/**
 * « Supprimer mon compte » — écran 18. UN composant, DEUX routes
 * (`/compte/informations/supprimer`, `/vendeur/informations/supprimer`),
 * comme « Mes informations » : l'espace est IMPOSÉ par la route, et il
 * décide quel compte disparaît. Supprimer le compte client laisse la
 * boutique intacte, et inversement (2026-10-23).
 */
export async function DeleteAccountScreen({ espace, erreur }: { espace: Espace; erreur?: string }) {
  const supabase = await createClient();
  const [profiles, supprimes] = await Promise.all([getMyProfiles(supabase), getMyDeletedRoles(supabase)]);
  const moi = profiles.find((p) => p.role === espace);
  const autre = profiles.find((p) => p.role !== espace);

  /* Plus aucun compte actif, mais la connexion est encore ouverte : une
     suppression interrompue avant la fermeture de la connexion. L'écran
     reste ouvert pour la terminer — fermé, il laissait la personne
     connectée, son email bloqué, sans chemin pour finir. */
  const interrompue = profiles.length === 0 && supprimes.length > 0;
  if (!moi && !interrompue) redirect(await clientSpaceFallback(supabase));

  const action = espace === "merchant" ? deleteMerchantAccountAction : deleteClientAccountAction;
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";
  const texte = interrompue ? TEXTES.interrompue : TEXTES[espace];
  const suite = interrompue
    ? ""
    : autre
      ? ` ${TEXTES.autreReste[espace]}`
      : " C'est votre seul compte : vous serez déconnecté, et votre adresse email pourra resservir.";

  return (
    <Sheet title={texte.titre} description={texte.description + suite} closeHref={retour} tone="danger">
      <Notice>{erreur}</Notice>
      <form action={action} className="space-y-4">
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
          {texte.bouton}
        </Button>
      </form>
    </Sheet>
  );
}

const TEXTES = {
  client: {
    titre: "Supprimer votre compte client ?",
    description:
      "Votre nom et votre téléphone seront effacés de ce compte. Vos conversations restent lisibles par les boutiques, sans votre identité. Cette action est irréversible.",
    bouton: "Supprimer mon compte client",
  },
  merchant: {
    titre: "Supprimer votre boutique ?",
    description:
      "Vos produits seront retirés du catalogue, leurs photos et les coordonnées de la boutique effacées. Vos conversations restent lisibles par vos clients. Cette action est irréversible.",
    bouton: "Supprimer ma boutique",
  },
  interrompue: {
    titre: "Terminer la suppression ?",
    description: "Votre suppression a été interrompue. Confirmez pour fermer votre compte.",
    bouton: "Terminer la suppression",
  },
  autreReste: {
    client: "Votre boutique n'est pas touchée : vous la retrouverez aussitôt.",
    merchant: "Votre compte client n'est pas touché : vous le retrouverez aussitôt.",
  },
} as const;
