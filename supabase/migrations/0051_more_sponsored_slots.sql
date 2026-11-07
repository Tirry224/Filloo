-- =====================================================================
-- 0051 : six produits sponsorisés au plus par appel (au lieu de 4)
-- =====================================================================
-- Décision du porteur du projet du 2026-11-07 : l'accueil montre 5
-- produits sponsorisés, la recherche et les catégories 3, « Boutiques à
-- découvrir » 10 boutiques. `produits_sponsorises` (0047) plafonnait
-- `p_limit` à 4 : l'accueil n'en aurait jamais eu 5.
-- Branche `monetisation` : NE S'APPLIQUE PAS avant que le porteur du
-- projet publie cette branche, et s'applique APRÈS 0048, 0049, 0050.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `produits_sponsorises` rend au plus 6 produits par appel, quel que
--    soit `p_limit` (6 = 5 de l'accueil + une marge, toujours borné).
-- 2. Tout le reste est inchangé : même signature (text, int, int), même
--    défaut `p_limit` = 2, mêmes filtres de visibilité, un produit par
--    boutique, tirage au sort, mêmes droits (anon, authenticated).
--
-- CHOIX
-- - Définition recopiée de 0047, la seule (0048, 0049, 0050 ne la
--   redéfinissent pas, vérifié le 2026-11-07) ; SEUL le `4` du `least`
--   devient `6`.
-- - `boutiques_mises_en_avant` plafonne déjà à 12 : 10 passent, non
--   touchée.
-- - `create or replace` garde les droits ; ils sont reposés quand même,
--   à l'identique de 0047, pour que ce fichier se lise seul.
--
-- COMPATIBILITÉ : l'app mobile n'appelle pas cette fonction (constaté le
-- 2026-11-07 dans /home/user/filloo-mobile : RPC `search_products`,
-- `conversation_is_open`, `enregistrer_telephone` seulement). Le site
-- l'appelle par `src/lib/data/publicite.ts` : signature et colonnes
-- inchangées, `database.types.ts` ne bouge pas.

create or replace function public.produits_sponsorises(
  p_query       text default null,
  p_category_id int  default null,
  p_limit       int  default 2
)
returns table (
  product_id      uuid,
  title           text,
  price_gnf       bigint,
  is_negotiable   boolean,
  status          public.product_status,
  category_id     int,
  category_name   text,
  is_featured     boolean,
  contact_count   int,
  created_at      timestamptz,
  merchant_id     uuid,
  shop_name       text,
  city_id         int,
  city_name       text,
  image_path      text,
  shop_photo_path text,
  campagne_id     uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.product_id, s.title, s.price_gnf, s.is_negotiable, s.status,
         s.category_id, s.category_name, s.is_featured, s.contact_count, s.created_at,
         s.merchant_id, s.shop_name, s.city_id, s.city_name, s.image_path,
         s.shop_photo_path, s.campagne_id
    from (
      select distinct on (m.id)
             p.id            as product_id,
             p.title         as title,
             p.price_gnf     as price_gnf,
             p.is_negotiable as is_negotiable,
             p.status        as status,
             p.category_id   as category_id,
             cat.name        as category_name,
             p.is_featured   as is_featured,
             p.contact_count as contact_count,
             p.created_at    as created_at,
             m.id            as merchant_id,
             m.shop_name     as shop_name,
             ci.id           as city_id,
             ci.name         as city_name,
             img.storage_path as image_path,
             m.photo_path    as shop_photo_path,
             ca.id           as campagne_id
        from public.campagnes ca
        join public.products   p   on p.id = ca.product_id and p.merchant_id = ca.merchant_id
        join public.merchants  m   on m.id = p.merchant_id
        join public.profiles   pf  on pf.id = m.profile_id
        join public.cities     ci  on ci.id = m.city_id
        join public.categories cat on cat.id = p.category_id
        left join lateral (
          select pi.storage_path
            from public.product_images pi
           where pi.product_id = p.id
           order by pi.position
           limit 1
        ) img on true
       where ca.type in ('produit', 'categorie')
         and ca.statut = 'active'
         and ca.debut_at <= now() and now() < ca.fin_at
         and p.status = 'active'
         and not p.masque_par_equipe
         and m.status = 'approved'
         and not pf.is_suspended
         and not pf.is_deleted
         and (
           (p_category_id is null and ca.type = 'produit')
           or (p_category_id is not null and (
                (ca.type = 'categorie' and ca.category_id = p_category_id)
             or (ca.type = 'produit'   and p.category_id  = p_category_id)))
         )
         -- Copie exacte du critère texte de `search_products` (0030).
         and (
           p_query is null or trim(p_query) = ''
           or extensions.unaccent(p.title)                    ilike '%' || extensions.unaccent(trim(p_query)) || '%'
           or extensions.unaccent(coalesce(p.description, '')) ilike '%' || extensions.unaccent(trim(p_query)) || '%'
           or extensions.unaccent(m.shop_name)                ilike '%' || extensions.unaccent(trim(p_query)) || '%'
         )
       order by m.id, random()
    ) s
   order by random()
   limit least(greatest(coalesce(p_limit, 2), 0), 6);
$$;

revoke execute on function public.produits_sponsorises(text, int, int) from public;
grant execute on function public.produits_sponsorises(text, int, int) to anon, authenticated;
