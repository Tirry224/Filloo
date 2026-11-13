import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile } from "@/lib/data/session";
import { getMesFavoris } from "@/lib/data/favoris";

/**
 * Les boutiques que le client a mises en favori (cœur de la page
 * boutique). Un appui ouvre la boutique et ses produits ; on retire un
 * favori depuis la boutique elle-même, là où le cœur est.
 */
export default async function FavorisPage() {
  const supabase = await createClient();
  const client = await getMyProfile(supabase, "client");
  if (!client) redirect(await clientSpaceFallback(supabase));

  const boutiques = await getMesFavoris(supabase, client.id);

  return (
    <Screen>
      <TopBar title="Mes boutiques favorites" backHref="/compte" />
      <ScreenBody>
        <Section className="gap-4">
          {boutiques.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Aucune boutique favorite. Touchez le cœur en haut d&apos;une boutique pour la retrouver ici.
            </p>
          ) : (
            <Card className="px-3.5">
              {boutiques.map((b) => (
                <Link
                  key={b.id}
                  href={`/boutique/${b.id}`}
                  className="flex items-center gap-3.5 border-b border-line py-3 last:border-b-0"
                >
                  <Avatar name={b.shopName} kind="shop" size={44} src={b.photoUrl} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-base font-semibold">{b.shopName}</span>
                    <span className="truncate text-sm text-ink-soft">{b.city}</span>
                  </span>
                  <ChevronRight size={18} strokeWidth={2} aria-hidden className="shrink-0 text-ink-soft" />
                </Link>
              ))}
            </Card>
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
