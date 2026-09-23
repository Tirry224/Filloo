import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { Wordmark } from "@/components/ui/TopBar";
import { safeNextPath } from "@/lib/next-param";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next) ?? undefined;
  return (
    <Screen>
      <ScreenBody className="justify-center">
        <Section className="gap-4 p-7">
          <div className="mb-1 flex flex-col gap-2">
            <Wordmark size="lg" />
            <p className="text-base text-ink-soft">Trouvez des produits et des commerçants près de chez vous.</p>
          </div>

          <LoginForm next={next} />

          <p className="mt-1 text-center text-sm text-ink-soft">
            Vous pouvez <Link href="/" className="font-semibold text-accent">parcourir les produits</Link> sans compte.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
