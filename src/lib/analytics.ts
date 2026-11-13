import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { nEstPasUnePersonne } from "@/lib/robots-detecte";
import { createAdminClient } from "@/lib/supabase/admin";
import { COOKIE_VISITEUR, lireVisiteur } from "@/lib/visiteur";

/**
 * Les compteurs d'usage de Filloo — côté SERVEUR uniquement.
 *
 * Pas de garde `import "server-only"` : ce serait une dépendance de plus
 * pour un interdit que deux choses rendent déjà impossible — `after()`
 * n'existe pas dans le navigateur, et `createAdminClient` lit une variable
 * sans préfixe `NEXT_PUBLIC_`, donc absente du bundle client.
 *
 * CE QU'ON N'ÉCRIT JAMAIS : aucun identifiant de profil, aucune adresse
 * IP, aucun agent utilisateur, aucun contenu de message. `role` dit ce
 * qu'était celui qui a agi, pas qui il est. Seule exception, décidée le
 * 2026-11-07 : `visiteur_id`, le numéro ALÉATOIRE du cookie de mesure
 * (`lib/visiteur.ts`), qui reconnaît un navigateur sans dire à qui il est. La politique de
 * confidentialité décrit exactement cela ; c'est elle qui fixe la limite
 * de ce fichier, et non l'inverse.
 *
 * `service_role` parce que la table refuse `anon` et `authenticated` des
 * deux côtés — RLS sans policy ET privilèges révoqués (migration 0024).
 * Le navigateur ne l'atteint par aucun chemin : ni requête directe, ni
 * RPC. C'est ce qui garantit que les chiffres ne sont pas fabriqués.
 */

export type NomEvenement =
  | "visite"
  | "recherche"
  | "produit_vu"
  | "boutique_vue"
  | "contact_ouvert"
  | "contact_abouti"
  | "whatsapp_ouvert"
  | "message_envoye"
  | "inscription"
  | "boutique_creee"
  | "produit_cree"
  /* Un refus de création ou de modification de produit (2026-11-13) : la
     raison part sur Telegram (`lib/telegram.ts`), pas ici. */
  | "publication_refusee"
  /* La publicité (0047) : un affichage et un clic, rattachés à la campagne. */
  | "pub_vue"
  | "pub_clic";

export type ContexteEvenement = {
  /** Ce qu'était celui qui a agi, jamais qui il est. */
  role?: "anon" | "client" | "merchant";
  productId?: string | null;
  merchantId?: string | null;
  categoryId?: number | null;
  cityId?: number | null;
  query?: string | null;
  resultCount?: number | null;
  campagneId?: string | null;
};

/** La borne de la colonne `search_query` (0024). Tronquer ici plutôt que
 * laisser la base refuser : une mesure perdue pour un mot trop long
 * serait une mesure perdue sur exactement les recherches les plus
 * étranges, donc les plus intéressantes. */
const LONGUEUR_MAX_RECHERCHE = 120;

function normaliserRequete(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const propre = brut.trim().toLowerCase().replace(/\s+/g, " ");
  return propre ? propre.slice(0, LONGUEUR_MAX_RECHERCHE) : null;
}

/**
 * À appeler avec `await` : les en-têtes se lisent pendant la requête, pas
 * dans `after()`. Un robot ou un préchargement n'est pas compté
 * (`robots-detecte.ts`, depuis le 2026-11-05).
 */
export async function compter(nom: NomEvenement, contexte: ContexteEvenement = {}): Promise<void> {
  let visiteurId: string | null = null;
  try {
    if (nEstPasUnePersonne(await headers())) return;
    visiteurId = lireVisiteur((await cookies()).get(COOKIE_VISITEUR)?.value);
  } catch {
    // Hors requête (script, test) : rien à décider, on compte.
  }
  after(async () => {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("analytics_events").insert({
        name: nom,
        actor_role: contexte.role ?? null,
        product_id: contexte.productId ?? null,
        merchant_id: contexte.merchantId ?? null,
        category_id: contexte.categoryId ?? null,
        city_id: contexte.cityId ?? null,
        search_query: normaliserRequete(contexte.query),
        result_count: contexte.resultCount ?? null,
        campagne_id: contexte.campagneId ?? null,
        visiteur_id: visiteurId,
      });
      if (error) console.error(`[mesure] ${nom} non enregistré :`, error.message);
    } catch (cause) {
      console.error(
        `[mesure] ${nom} non enregistré :`,
        cause instanceof Error ? cause.message : cause,
      );
    }
  });
}
