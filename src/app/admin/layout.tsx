import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireEquipe } from "@/lib/data/equipe";

export const metadata: Metadata = {
  title: "Équipe Filloo",
  robots: { index: false, follow: false },
};

/* À la requête : la garde lit la session. */
export const dynamic = "force-dynamic";

/**
 * La frontière de l'espace de l'équipe (0042). Ce fichier ne dessine
 * rien, comme `(vendeur)/layout.tsx` : un écran ajouté plus tard sera
 * protégé sans que son auteur y pense. L'habillage vit dans `(onglets)`
 * (barre de navigation) et `(plein-ecran)` (un fil, sans barre).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await requireEquipe(supabase);
  return <>{children}</>;
}
