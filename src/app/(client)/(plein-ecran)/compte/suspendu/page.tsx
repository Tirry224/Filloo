import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfiles, landingForSession } from "@/lib/data/session";

/**
 * Écran 19 — compte suspendu.
 *
 * La suspension coupe l'écriture, pas la lecture : le catalogue reste
 * consultable. Couper tout d'un coup pousse la personne à créer un second
 * compte, ce qui annule la sanction.
 *
 * `profiles` n'a pas de colonne « motif de suspension » — seulement
 * `suspended_at`. La maquette inventait « à la suite de signalements » ;
 * retiré plutôt que simulé, comme le reste des champs sans colonne réelle
 * trouvés cette session (voir docs/REPRISE.md).
 */
export default async function SuspendedPage() {
  const supabase = await createClient();

  // Cet écran cherchait UNIQUEMENT un profil client, et c'était la moitié
  // d'une règle : la suspension vit sur `profiles`, donc elle frappe un
  // commerçant exactement pareil. Un commerçant suspendu qu'on aurait
  // envoyé ici aurait été renvoyé vers son espace, qui l'aurait renvoyé
  // ici — une boucle. D'où la recherche par SUSPENSION plutôt que par
  // rôle : c'est la propriété qui compte, pas le rôle qui la porte.
  const profiles = await getMyProfiles(supabase);
  const suspended = profiles.find((p) => p.isSuspended && !p.isDeleted);
  // Deux sorties distinctes, parce que ce sont deux situations
  // distinctes : sans profil du tout on n'est pas connecté et on va se
  // connecter ; avec un profil non suspendu, on n'a rien à faire ici et
  // on repart vers son écran d'ouverture.
  if (profiles.length === 0) redirect(await clientSpaceFallback(supabase));
  if (!suspended) redirect(await landingForSession(supabase));

  /* La suspension frappe un PROFIL, jamais une connexion (docs/SPEC.md,
     décision 8 : « suspendre le compte client ne gèle pas la boutique »).
     Cet écran l'affirmait dans son commentaire et le démentait à l'écran :
     quelqu'un dont le compte client est suspendu mais dont la boutique
     tourne n'avait ici qu'un bouton « Voir les produits », c'est-à-dire
     aucune mention du seul espace qui lui reste ouvert. Il en concluait
     que tout était bloqué.

     La bascule n'est pas un raccourci de confort : c'est ce qui rend la
     règle visible. Même carte que `/compte` et `/vendeur/boutique`, pour
     que changer d'espace se reconnaisse partout au même geste. */
  /* espaces:autorise — la suspension frappe un PROFIL, pas la connexion.
     Quelqu'un dont le compte commerçant est suspendu mais dont le compte
     client reste actif (et l'inverse) doit pouvoir rejoindre celui qui
     lui reste : c'est un geste de bascule, comme `SwitchSpaceCard`, pas
     une redirection subie. Le refuser enfermerait la personne sur un
     écran d'impasse — et cet écran promet justement le contraire. */
  const stillActive = profiles.find((p) => !p.isSuspended && !p.isDeleted);

  return (
    <Screen>
      <TopBar title={<Wordmark />} />
      <ScreenBody>
        <EmptyState
          icon={Flag}
          title="Votre compte est suspendu"
          description={
            suspended.role === "merchant"
              ? "Vous pouvez encore consulter le catalogue, mais pas publier de produit ni répondre à vos clients."
              : "Vous pouvez encore consulter le catalogue, mais pas envoyer de messages."
          }
        >
          <Button variant="secondary" href="/">
            Voir les produits
          </Button>
        </EmptyState>
        {stillActive ? (
          <Section className="pt-0">
            <SwitchSpaceCard
              label={
                stillActive.role === "merchant"
                  ? "Basculer vers mon espace commerçant"
                  : "Basculer vers mon espace client"
              }
              target={
                stillActive.role === "merchant"
                  ? "Cette suspension ne touche pas votre boutique."
                  : "Cette suspension ne touche pas votre compte client."
              }
              href={stillActive.role === "merchant" ? "/vendeur" : "/compte"}
            />
          </Section>
        ) : null}
        <Section className="pt-0">
          <p className="rounded-lg bg-warn-soft px-3.5 py-3 text-sm leading-normal text-warn-ink">
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, écrivez-nous en expliquant la
            situation. Nous répondons sous 72 heures.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
