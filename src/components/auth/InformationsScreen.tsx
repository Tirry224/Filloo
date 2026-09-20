import { redirect } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { ConfirmPasswordSave } from "@/components/auth/ConfirmPasswordSave";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfiles, getSessionUser } from "@/lib/data/session";
import { getCities } from "@/lib/data/reference";
import type { Espace } from "@/lib/espace";

/**
 * Mes informations — écran 18, monté par les DEUX espaces.
 *
 * UN COMPOSANT, DEUX ROUTES, comme `TermsScreen` : même contenu, chemin
 * de RETOUR différent — un commerçant qui corrige son numéro ne doit pas
 * ressortir dans son espace d'acheteur.
 *
 * Pas derrière la garde « profil CLIENT » de `/compte/informations`, où
 * un commerçant sans compte client lié ne pourrait jamais corriger son
 * nom : ce qui appartient à la CONNEXION ne vit pas derrière la porte
 * d'un seul rôle (même trou que le mot de passe et la suppression).
 *
 * Profils dérivés : on affiche le CLIENT s'il existe, seul modifiable
 * jusqu'ici, donc seul porteur des corrections — l'inverse recopierait
 * une vieille valeur par-dessus dès le premier enregistrement.
 */
export async function InformationsScreen({ espace }: { espace: Espace }) {
  const supabase = await createClient();
  const [profiles, user, cities] = await Promise.all([
    getMyProfiles(supabase),
    getSessionUser(supabase),
    getCities(supabase),
  ]);

  const client = profiles.find((p) => p.role === "client");
  const commercant = profiles.find((p) => p.role === "merchant");
  const identite = client ?? commercant;
  /* Aucun profil utilisable : personne n'est connecté. `clientSpaceFallback`
     distingue ce cas d'un rôle manquant et envoie se connecter. */
  if (!identite || !user) redirect(await clientSpaceFallback(supabase));

  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";

  return (
    <Screen>
      <TopBar
        title="Mes informations"
        backHref={retour}
        right={<ConfirmPasswordSave formId="profile-form" />}
      />
      <ScreenBody>
        <Section className="gap-4">
          <ProfileForm
            id="profile-form"
            espace={espace}
            fullName={identite.fullName}
            phone={identite.phone}
            cityId={client?.cityId ?? null}
            cities={cities}
          />

          <Field
            label="Email"
            htmlFor="email"
            hint="L'email sert à vous connecter. Contactez-nous pour le changer."
          >
            <Input id="email" type="email" defaultValue={user.email ?? ""} disabled />
          </Field>

          {/* Côté commerçant, la suppression vit déjà sur
              `/vendeur/boutique` : une action qui porte sur la CONNEXION
              ne s'offre qu'à un endroit par espace, sinon on croit à deux
              suppressions différentes. */}
          {espace === "client" ? (
            <Link
              href="/compte/informations/supprimer"
              className="mt-1 flex cursor-pointer items-center gap-2.5 text-base font-semibold text-danger"
            >
              <Trash2 size={19} strokeWidth={2} aria-hidden />
              Supprimer mon compte
            </Link>
          ) : null}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
