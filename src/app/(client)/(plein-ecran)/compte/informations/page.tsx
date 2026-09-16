import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { Field, Input } from "@/components/ui/Field";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile, getSessionUser } from "@/lib/data/session";
import { getCities } from "@/lib/data/reference";

/**
 * Mes informations — écran 18. Un champ de la maquette n'a pas de colonne
 * réelle : le mot de passe affiché en clair (Supabase ne le rend jamais
 * lisible, avec raison) — retiré plutôt que simulé avec une fausse valeur.
 * La ville, elle, est branchée sur `profiles.city_id`
 * (0010_client_profile_city.sql) : un client peut désormais choisir sa
 * ville de résidence, indépendamment de la ville de navigation du fil
 * (`/recherche/ville`, un simple paramètre d'URL, pas une donnée de
 * profil).
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const [profile, user, cities] = await Promise.all([
    getMyProfile(supabase, "client"),
    getSessionUser(supabase),
    getCities(supabase),
  ]);
  if (!profile || !user) redirect(await clientSpaceFallback(supabase));

  return (
    <Screen>
      <TopBar
        title="Mes informations"
        backHref="/compte"
        right={
          <button type="submit" form="profile-form" className="cursor-pointer text-base font-semibold text-accent">
            Enregistrer
          </button>
        }
      />
      <ScreenBody>
        <Section className="gap-4">
          <ProfileForm
            id="profile-form"
            fullName={profile.fullName}
            phone={profile.phone}
            cityId={profile.cityId}
            cities={cities}
          />

          <Field
            label="Email"
            htmlFor="email"
            hint="L'email sert à vous connecter. Contactez-nous pour le changer."
          >
            <Input id="email" type="email" defaultValue={user.email ?? ""} disabled />
          </Field>

          <div className="my-1 h-px bg-line" />

          <UpdatePasswordForm />

          <Link
            href="/compte/informations/supprimer"
            className="mt-1 flex cursor-pointer items-center gap-2.5 text-base font-semibold text-danger"
          >
            <Trash2 size={19} strokeWidth={2} aria-hidden />
            Supprimer mon compte
          </Link>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
