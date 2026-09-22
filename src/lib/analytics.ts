import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Les compteurs d'usage de Makiti — côté SERVEUR uniquement.
 *
 * Pas de garde `import "server-only"` : ce serait une dépendance de plus
 * pour un interdit que deux choses rendent déjà impossible — `after()`
 * n'existe pas dans le navigateur, et `createAdminClient` lit une variable
 * sans préfixe `NEXT_PUBLIC_`, donc absente du bundle client.
 *
 * POURQUOI PAS UN OUTIL EXTERNE. Un script d'analytics du marché pèse
 * entre 1 et 40 Ko de JavaScript, part chez un tiers, et demande une
 * bannière de consentement. Les trois coûtent cher ici : le budget de
 * poids est tenu à 165 Ko sur 200 (docs/PERFORMANCE.md), le réseau
 * guinéen fait payer chaque kilo-octet, et une bannière posée sur le
 * premier écran est la première chose qu'un visiteur voit.
 *
 * Or presque tout ce qu'on veut compter se produit DÉJÀ côté serveur :
 * les fiches produit et boutique sont des composants serveur, la
 * recherche aussi, et l'inscription, la création de boutique, la
 * publication d'un produit et l'envoi d'un message sont des actions
 * serveur. Mesurer là où la chose arrive coûte zéro octet au téléphone et
 * fonctionne même sans JavaScript — ce qui, sur ce réseau, arrive.
 *
 * CE QU'ON N'ÉCRIT JAMAIS : aucun identifiant de profil, aucune adresse
 * IP, aucun agent utilisateur, aucun contenu de message. `role` dit ce
 * qu'était celui qui a agi, pas qui il est. La politique de
 * confidentialité décrit exactement cela ; c'est elle qui fixe la limite
 * de ce fichier, et non l'inverse.
 *
 * NE LÈVE JAMAIS. Une mesure est un confort, jamais une condition : un
 * compteur en panne ne doit pas empêcher quelqu'un de contacter un
 * commerçant. Tout est avalé et journalisé.
 *
 * `service_role` parce que la table refuse `anon` et `authenticated` des
 * deux côtés — RLS sans policy ET privilèges révoqués (migration 0024).
 * Le navigateur ne l'atteint par aucun chemin : ni requête directe, ni
 * RPC. C'est ce qui garantit que les chiffres ne sont pas fabriqués.
 */

/**
 * La liste fermée des événements. En TypeScript et non en base : ajouter
 * une mesure ne doit pas demander une migration, sinon on renonce à
 * mesurer. Mais fermée quand même — un nom libre finit par exister en
 * trois orthographes, et trois orthographes ne se somment pas.
 */
export type NomEvenement =
  /** Arrivée sur l'écran d'ouverture. Le dénominateur de tout le reste. */
  | "visite"
  /** Une recherche a été lancée. Porte les mots tapés et le nombre de
   *  résultats : à zéro, c'est un client perdu ET un commerçant à aller
   *  chercher. C'est la mesure la plus utile du lot. */
  | "recherche"
  | "produit_vu"
  | "boutique_vue"
  /** L'écran « Contacter le vendeur » s'est ouvert — l'intention. */
  | "contact_ouvert"
  /** Un fil a réellement été ouvert avec une boutique — l'aboutissement.
   *  L'écart entre les deux est le taux de conversion de Makiti. */
  | "contact_abouti"
  | "message_envoye"
  | "inscription"
  | "boutique_creee"
  | "produit_cree";

export type ContexteEvenement = {
  /** Ce qu'était celui qui a agi, jamais qui il est. */
  role?: "anon" | "client" | "merchant";
  productId?: string | null;
  merchantId?: string | null;
  categoryId?: number | null;
  cityId?: number | null;
  /** Uniquement pour `recherche`. Tronqué et normalisé plus bas. */
  query?: string | null;
  resultCount?: number | null;
};

/** La borne de la colonne `search_query` (0024). Tronquer ici plutôt que
 * laisser la base refuser : une mesure perdue pour un mot trop long
 * serait une mesure perdue sur exactement les recherches les plus
 * étranges, donc les plus intéressantes. */
const LONGUEUR_MAX_RECHERCHE = 120;

function normaliserRequete(brut: string | null | undefined): string | null {
  if (!brut) return null;
  /* Minuscules et espaces écrasés : « Riz  BRISÉ » et « riz brisé » sont
     la même recherche, et comptées séparément elles ne diraient rien. */
  const propre = brut.trim().toLowerCase().replace(/\s+/g, " ");
  return propre ? propre.slice(0, LONGUEUR_MAX_RECHERCHE) : null;
}

/**
 * Enregistre un événement APRÈS que la réponse est partie.
 *
 * `after()` est la raison pour laquelle cette mesure ne coûte rien au
 * visiteur : l'insertion se fait une fois la page envoyée, exactement
 * comme les emails de notification. Sans lui, chaque fiche produit
 * attendrait un aller-retour de base supplémentaire avant de s'afficher —
 * ce qui reviendrait à ralentir le produit pour savoir s'il est lent.
 */
export function compter(nom: NomEvenement, contexte: ContexteEvenement = {}): void {
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
      });
      if (error) console.error(`[mesure] ${nom} non enregistré :`, error.message);
    } catch (cause) {
      /* Le cas le plus probable : `SUPABASE_SERVICE_ROLE_KEY` absente, ce
         que `createAdminClient` signale en levant. Journalisé une fois par
         événement plutôt qu'en silence — mais jamais propagé : personne ne
         doit voir une page d'erreur parce qu'un compteur n'a pas pu
         s'incrémenter. */
      console.error(
        `[mesure] ${nom} non enregistré :`,
        cause instanceof Error ? cause.message : cause,
      );
    }
  });
}
