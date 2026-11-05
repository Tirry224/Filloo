import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TableauDeBord } from "@/components/suivi/TableauDeBord";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { getSessionUser } from "@/lib/data/session";
import { signOutAction } from "@/lib/actions/auth";
import { estProprietaire } from "@/lib/proprietaire";
import { lirePeriode } from "@/lib/data/suivi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Suivi",
  robots: { index: false, follow: false },
};

/* À la requête : la garde lit la session, et des chiffres figés au build
   ne diraient rien. */
export const dynamic = "force-dynamic";

/**
 * L'écran du porteur du projet : ce qui se passe dans Filloo, sans écrire
 * de SQL. Pour TOUS les autres, cette page n'existe pas — `notFound()` et
 * non un refus, pour ne pas dire qu'il y a ici quelque chose à forcer.
 */
export default async function SuiviPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!estProprietaire(user)) notFound();

  const periode = lirePeriode((await searchParams).periode);

  return (
    <Screen largeur="rangees">
      <TopBar
        title="Suivi"
        right={
          <form action={signOutAction}>
            <button type="submit" className="text-sm font-medium text-ink-soft underline underline-offset-2">
              Se déconnecter
            </button>
          </form>
        }
      />
      <TableauDeBord base="/suivi" periode={periode} />
    </Screen>
  );
}
