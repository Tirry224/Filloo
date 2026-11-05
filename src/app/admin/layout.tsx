import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireEquipe } from "@/lib/data/equipe";

export const metadata: Metadata = {
  title: "Équipe Filloo",
  robots: { index: false, follow: false },
};

/* À la requête : la garde lit la session. */
export const dynamic = "force-dynamic";

/**
 * L'espace de l'équipe (0042) : la boîte des fils et les annonces. Un
 * layout et non un contrôle par écran, comme `(vendeur)/layout.tsx` : un
 * écran ajouté plus tard sera protégé sans que son auteur y pense.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireEquipe(supabase);

  return (
    <>
      <nav aria-label="Espace de l'équipe" className="mx-auto flex max-w-rangees gap-4 px-4 pt-4 text-sm font-medium">
        <Link href="/admin" className="text-ink underline-offset-2 hover:underline">
          Boîte
        </Link>
        <Link href="/admin/annonces" className="text-ink underline-offset-2 hover:underline">
          Annonces
        </Link>
      </nav>
      {children}
    </>
  );
}
