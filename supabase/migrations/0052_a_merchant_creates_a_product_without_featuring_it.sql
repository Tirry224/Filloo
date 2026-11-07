-- =====================================================================
-- 0052 — Un commerçant crée un produit sans pouvoir le mettre « à la une »
-- =====================================================================
-- Constaté en production le 2026-11-07 (`role_table_grants`) : `anon` et
-- `authenticated` ont `INSERT` au niveau TABLE sur `products` (défaut
-- Supabase, jamais révoqué : 0002 n'a fermé que l'UPDATE). Un commerçant
-- pouvait donc créer son produit avec :
--   - `is_featured = true`, que `search_products` classe en premier ;
--   - `contact_count = 999`, qui le place en tête du tri « populaire » ;
--   - `masque_par_equipe`, `created_at`, `updated_at` à sa guise.
-- La policy « products: je cree mes produits » (0039) choisit la LIGNE
-- (sa boutique, compte actif) ; elle ne voit pas les colonnes.
--
-- Même remède que 0002 pour l'UPDATE : révoquer la table, ré-accorder
-- colonne par colonne. La liste est celle que le site
-- (`src/lib/actions/products.ts`, `createProductAction`) et l'app
-- (`Filloo-mobile/src/lib/edition-produit.ts`, `creerProduit`, seule
-- forme de l'insertion dans tout l'historique de l'app) envoient
-- réellement : id, merchant_id, category_id, title, description,
-- price_gnf, is_negotiable, status. Les autres colonnes prennent leur
-- défaut (constatés en production : false, 0, now(), now(), false).
--
-- Rien pour `anon` : aucun écran n'insère un produit sans compte, et la
-- policy le refusait déjà (pas de boutique).
--
-- Données : 0 produit `is_featured` et `contact_count` au plus 1 en
-- production le 2026-11-07 : rien à rattraper.
--
-- `service_role` et les fonctions `security definer` (propriétaire
-- `postgres`) ne sont pas concernés. Une colonne ajoutée plus tard à
-- `products` (par exemple `masque_par_limite` sur la branche
-- `monetisation`) n'est PAS insérable par un commerçant tant qu'une
-- migration ne la lui accorde pas.

revoke insert on public.products from anon, authenticated;

grant insert (id, merchant_id, category_id, title, description, price_gnf, is_negotiable, status)
  on public.products to authenticated;
