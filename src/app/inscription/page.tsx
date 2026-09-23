import { redirect } from "next/navigation";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { SignupForm } from "@/components/auth/SignupForm";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next) ?? undefined;
  const supabase = await createClient();
  const profiles = await getMyProfiles(supabase);

  if (profiles.length >= 2) redirect("/compte");

  const mode = profiles.length > 0 ? "linked" : "new";
  const existing = profiles[0];

  return (
    <Screen>
      <TopBar title="Créer un compte" backHref={next ?? "/"} />

      <ScreenBody>
        <Section className="gap-4">
          <SignupForm
            mode={mode}
            excludeRole={existing?.role}
            defaultFullName={existing?.fullName}
            defaultPhone={existing?.phone}
            next={next}
          />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
