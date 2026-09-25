import { redirect } from "next/navigation";
import { Field, Input } from "@/components/ui/Field";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { ConfirmPasswordSave } from "@/components/auth/ConfirmPasswordSave";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfiles, getSessionUser } from "@/lib/data/session";
import { getCities } from "@/lib/data/reference";
import type { Espace } from "@/lib/espace";

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
        </Section>
      </ScreenBody>
    </Screen>
  );
}
