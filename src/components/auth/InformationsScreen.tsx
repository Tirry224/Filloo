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
 * UN COMPOSANT, DEUX ROUTES, comme `TermsScreen` et `ThreadScreen`, et
 * pour la même raison : le contenu est rigoureusement le même, le chemin
 * de RETOUR ne l'est pas. Un commerçant qui corrige son numéro ne doit
 * pas ressortir dans son espace d'acheteur.
 *
 * POURQUOI CET ÉCRAN A DÛ QUITTER L'ESPACE CLIENT
 * Il n'existait que sous `/compte/informations`, derrière une garde qui
 * exigeait un profil CLIENT. Un commerçant sans compte client lié ne
 * pouvait donc jamais corriger son nom ni son téléphone — le même trou
 * que celui déjà rebouché pour le mot de passe et pour la suppression de
 * compte. Trois fois la même leçon : ce qui appartient à la CONNEXION ne
 * peut pas vivre derrière la porte d'un seul rôle.
 *
 * QUELLE VALEUR ON AFFICHE QUAND LES DEUX PROFILS ONT DÉRIVÉ
 * Jusqu'ici, seul le profil client était modifiable : c'est donc lui, et
 * lui seul, qui peut porter une correction faite par la personne — le
 * profil commerçant en est resté à ce qui avait été tapé à l'inscription.
 * On affiche donc le client quand il existe, et le commerçant sinon.
 * L'inverse aurait fait recopier une vieille valeur par-dessus une valeur
 * corrigée, au premier enregistrement, sans que personne ne le voie
 * passer. La dérive se referme à cet enregistrement-là.
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
     sait déjà distinguer ce cas de celui d'une connexion qui n'a pas le
     bon rôle, et envoie se connecter plutôt qu'au catalogue. */
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

          {/* La suppression n'est proposée ICI que côté client. Côté
              commerçant, elle vit déjà sur `/vendeur/boutique` — même
              règle d'emplacement unique que le mot de passe et les
              notifications : une action qui porte sur la CONNEXION ne
              doit pas s'offrir deux fois dans le même espace, sans quoi
              on croit à deux suppressions différentes. */}
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
