import { redirect } from "next/navigation";

/** Ancienne liste unique (0063) : acheteurs et vendeurs ont chacun la leur
 *  depuis le 2026-11-07. L'adresse reste, pour les liens déjà gardés. */
export default async function ComptesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(`/admin/gestion/vendeurs${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}
