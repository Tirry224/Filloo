import { redirect } from "next/navigation";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { SignupForm } from "@/components/auth/SignupForm";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles, getSessionUser } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; role?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  const supabase = await createClient();
  const profiles = await getMyProfiles(supabase);

  if (profiles.length >= 2) redirect("/compte");

  /* Connecté SANS profil : une connexion venue de Google (`0073`), qui
     revient de `/auth/confirm`. L'inscription par email crée son profil
     d'office, une connexion supprimée est bannie (0068) : ce cas n'existe
     que pour Google. */
  const user = profiles.length === 0 ? await getSessionUser(supabase) : null;
  const mode = profiles.length > 0 ? "linked" : user ? "complete" : "new";
  const existing = profiles[0];
  const nomGoogle = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").trim();

  return (
    <Screen>
      <TopBar title={mode === "complete" ? "Complétez votre compte" : "Créer un compte"} backHref={next ?? "/"} />

      <ScreenBody>
        <Section className="gap-4">
          <SignupForm
            mode={mode}
            excludeRole={existing?.role}
            defaultFullName={mode === "complete" ? nomGoogle || undefined : existing?.fullName}
            defaultRole={params.role === "merchant" ? "merchant" : undefined}
            defaultPhone={existing?.phone}
            next={next}
          />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
