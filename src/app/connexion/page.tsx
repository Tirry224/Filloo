import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { ResendConfirmationForm } from "@/components/auth/ResendConfirmationForm";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { Wordmark } from "@/components/ui/TopBar";
import { safeNextPath } from "@/lib/next-param";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  return (
    <Screen>
      <ScreenBody className="justify-center">
        <Section className="gap-4 p-7">
          <div className="mb-1 flex flex-col gap-2">
            <Wordmark size="lg" />
            <p className="text-base text-ink-soft">Trouvez des produits et des commerçants près de chez vous.</p>
          </div>

          {params.erreur === "lien_confirmation" ? (
            <div className="flex flex-col gap-2.5">
              <p className="rounded-lg bg-warn-soft px-3.5 py-3 text-sm leading-normal text-warn-ink">
                Ce lien de confirmation n&apos;est plus valable : il a expiré ou a déjà servi.
                Si votre adresse est déjà confirmée, connectez-vous. Sinon, demandez un
                nouveau lien.
              </p>
              <ResendConfirmationForm />
            </div>
          ) : null}

          <LoginForm next={next} />

          <p className="mt-1 text-center text-sm text-ink-soft">
            Vous pouvez <Link href="/" className="font-semibold text-accent">parcourir les produits</Link> sans compte.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
