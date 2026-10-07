import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Les chiffres de `/suivi`, l'écran du porteur du projet.
 *
 * TOUT passe par `service_role` : les mesures (0024) refusent `anon` et
 * `authenticated`, et compter les comptes demande l'API d'administration
 * de l'authentification. C'est exactement pourquoi la garde
 * `estProprietaire` (`src/lib/proprietaire.ts`) doit avoir répondu OUI avant le premier appel ici.
 */

export const PERIODES = {
  "24h": { libelle: "24 h", heures: 24 },
  "7j": { libelle: "7 jours", heures: 24 * 7 },
  "30j": { libelle: "30 jours", heures: 24 * 30 },
} as const;

export type Periode = keyof typeof PERIODES;

export function lirePeriode(valeur: unknown): Periode {
  return typeof valeur === "string" && valeur in PERIODES ? (valeur as Periode) : "7j";
}

type Roles = { total: number; anon: number; client: number; merchant: number };

export type Chiffres = {
  evenements: Record<string, Roles | undefined>;
  par_jour: {
    jour: string;
    visites: number;
    produits_vus: number;
    contacts: number;
    inscriptions: number;
    messages: number;
  }[];
  recherches: { mots: string; fois: number; vides: number }[];
  recherches_vides: { mots: string; fois: number }[];
  profils: {
    clients: number;
    commercants: number;
    nouveaux_clients: number;
    nouveaux_commercants: number;
    suspendus: number;
    supprimes: number;
  };
  boutiques: {
    total: number;
    en_attente: number;
    validees: number;
    refusees: number;
    nouvelles: number;
    sans_photo: number;
    sans_produit: number;
  };
  produits: { en_ligne: number; vendus: number; brouillons: number; masques: number; nouveaux: number };
  messagerie: {
    conversations: number;
    nouvelles_conversations: number;
    bloquees: number;
    messages: number;
    non_lus_24h: number;
    sans_reponse: number;
  };
  signalements: { a_traiter: number; nouveaux: number; produits: number; boutiques: number; conversations: number };
  notifications: { abonnements_push: number; en_attente: number; en_echec: number };
};

export type Connexions = {
  total: number;
  nouvelles: number;
  /** Inscrit, jamais cliqué le lien de confirmation : une inscription
   * commencée et perdue. */
  nonConfirmees: number;
  actives: number;
};

/** Ce que la base sait de la période (0034). */
export async function lireChiffres(depuis: Date): Promise<Chiffres> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("suivi_chiffres", { depuis: depuis.toISOString() });
  if (error) throw error;
  return data as unknown as Chiffres;
}

/**
 * Les connexions vivent dans `auth.users`, hors de portée du SQL exposé.
 * L'API d'administration les rend par pages : on les parcourt toutes,
 * sinon le total plafonnerait sans prévenir.
 */
export async function lireConnexions(depuis: Date): Promise<Connexions> {
  const admin = createAdminClient();
  const PAR_PAGE = 1000;
  const resultat: Connexions = { total: 0, nouvelles: 0, nonConfirmees: 0, actives: 0 };

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAR_PAGE });
    if (error) throw error;
    for (const u of data.users) {
      resultat.total++;
      if (new Date(u.created_at) >= depuis) resultat.nouvelles++;
      if (!u.email_confirmed_at) resultat.nonConfirmees++;
      if (u.last_sign_in_at && new Date(u.last_sign_in_at) >= depuis) resultat.actives++;
    }
    if (data.users.length < PAR_PAGE) break;
  }
  return resultat;
}
