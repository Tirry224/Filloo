-- =====================================================================
-- 0074 : un catalogue de mode seulement
-- =====================================================================
-- Décision du porteur du projet du 2026-11-10 : Filloo se recentre sur la
-- MODE. Contrainte : ne rien supprimer, ni catégorie ni produit. Les
-- anciennes catégories restent en base, mais ne sont plus montrées.
--
-- Constaté en production le 2026-11-10 (lecture seule) : 8 catégories
-- (mode, electronique, beaute, maison, materiaux, enfants, sport,
-- vehicules), positions 1..8 ; un seul produit, « Air force Kobe
-- Bryant » (des baskets), dans `mode` ; aucune campagne ne vise une
-- catégorie ; seule contrainte d'unicité de `categories` : `slug` (le nom
-- n'est unique que par `fixer_categorie`, 0066, à la casse et aux accents
-- près : aucun nom ci-dessous n'en heurte un ancien).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `categories.visible` (vrai par défaut) et `categories.famille`
--    ('vetements', 'chaussures', 'accessoires' ou rien). Toute catégorie
--    d'avant cette migration est MASQUÉE (`visible = false`), choisie par
--    son slug, jamais par son id. Seize catégories de mode, visibles,
--    rangées par famille, occupent les positions 1..16 ; les anciennes
--    suivent (17..), dans leur ordre : la règle « positions 1..n sans
--    trou » de 0067 reste vraie (aucune contrainte n'existe sur la
--    position, l'écart « 100+ » n'était donc pas nécessaire).
-- 2. Les produits de `mode` passent dans `chaussures` (le seul constaté
--    est une paire de baskets).
-- 3. `products.genre` ('femme', 'homme', 'enfant', 'mixte' ou rien),
--    `products.tailles` (au plus 25) et `products.couleurs` (au plus 20 : le site en propose 15),
--    jamais nuls. Les VALEURS permises sont celles du site
--    (`src/lib/mode.ts`) ; la base ne fait que borner : nombre, aucun
--    élément nul, longueur totale (500 et 400 caractères, de quoi tenir
--    25 tailles et 20 couleurs de 20 caractères), pour qu'un appel direct
--    à l'API ne range pas n'importe quel volume dans ces colonnes. Les
--    produits existants gardent un genre vide et des listes vides.
-- 4. Le commerçant écrit ces trois colonnes à la création et à la
--    modification (droits de colonne, comme les huit de 0052) ; rien
--    d'autre ne s'ouvre.
-- 5. Aucun produit n'ENTRE dans une catégorie masquée : ni à la création,
--    ni par un changement de catégorie (trigger, message en français). Un
--    produit qui y est déjà peut toujours être modifié sans changer de
--    catégorie (le trigger ne regarde que le changement).
-- 6. `search_products` ne rend que les produits des catégories visibles,
--    et filtre en plus par genre (« femme » et « homme » comprennent
--    « mixte »), taille, couleur et prix (bornes incluses). Les six
--    paramètres existants gardent leur nom, leur ordre et leur défaut :
--    tout appel d'avant (positionnel ou nommé) marche à l'identique.
-- 7. `produits_sponsorises` ne rend que les produits des catégories
--    visibles ; signature et droits inchangés.
--
-- CE QUI NE CHANGE PAS
-- - La policy « categories: lecture publique » reste `using (true)` : la
--   fiche d'un ancien produit (`categories(name)` en jointure) et l'écran
--   de l'équipe lisent toujours toutes les catégories. C'est le SITE qui
--   ne propose que `visible` (constaté, `getCategories`, src/lib/data/
--   reference.ts).
-- - `fixer_categorie` (0066) crée une catégorie visible, sans famille, en
--   fin de liste ; elle ne sait ni masquer ni ranger dans une famille.

-- ---------------------------------------------------------------------
-- 1. Les deux colonnes de `categories`
-- ---------------------------------------------------------------------
alter table public.categories
  add column visible boolean not null default true,
  add column famille text
    constraint categories_famille_check check (famille in ('vetements', 'chaussures', 'accessoires'));

-- ---------------------------------------------------------------------
-- 2. Les anciennes catégories se masquent et passent en fin de liste
-- ---------------------------------------------------------------------
-- Par slug : les huit constatées, et toute autre qui ne serait pas une des
-- seize de la mode (une base de test porte encore `alimentation`, 0003).
update public.categories c
   set visible = false
 where c.slug in ('mode', 'electronique', 'beaute', 'maison', 'materiaux', 'enfants', 'sport', 'vehicules')
    or c.slug not in ('robes', 'hauts', 'chemises', 'pantalons', 'jupes', 'ensembles',
                      'tenues-traditionnelles', 'vestes', 'tenues-sport', 'sous-vetements',
                      'chaussures', 'sacs', 'bijoux-montres', 'lunettes', 'foulards-chapeaux',
                      'ceintures');

-- Positions 17.. dans leur ordre d'avant (même tri que
-- `renumeroter_categories`, 0067).
update public.categories c
   set position = 16 + r.n
  from (select c2.id, (row_number() over (order by c2.position, c2.name, c2.id))::int as n
          from public.categories c2) r
 where c.id = r.id;

-- ---------------------------------------------------------------------
-- 3. Les seize catégories de la mode
-- ---------------------------------------------------------------------
-- Insertion simple, sans `on conflict` : si un de ces slugs existait déjà,
-- la migration échoue en entier plutôt que de laisser une catégorie
-- masquée sous un nom de la mode.
insert into public.categories (slug, name, position, famille, visible) values
  ('robes',                  'Robes',                     1, 'vetements',   true),
  ('hauts',                  'Hauts & T-shirts',          2, 'vetements',   true),
  ('chemises',               'Chemises',                  3, 'vetements',   true),
  ('pantalons',              'Pantalons & Jeans',         4, 'vetements',   true),
  ('jupes',                  'Jupes',                     5, 'vetements',   true),
  ('ensembles',              'Ensembles & Costumes',      6, 'vetements',   true),
  ('tenues-traditionnelles', 'Tenues traditionnelles',    7, 'vetements',   true),
  ('vestes',                 'Vestes & Manteaux',         8, 'vetements',   true),
  ('tenues-sport',           'Tenues de sport',           9, 'vetements',   true),
  ('sous-vetements',         'Sous-vêtements & Nuit',    10, 'vetements',   true),
  ('chaussures',             'Chaussures',               11, 'chaussures',  true),
  ('sacs',                   'Sacs',                     12, 'accessoires', true),
  ('bijoux-montres',         'Bijoux & Montres',         13, 'accessoires', true),
  ('lunettes',               'Lunettes',                 14, 'accessoires', true),
  ('foulards-chapeaux',      'Foulards & Chapeaux',      15, 'accessoires', true),
  ('ceintures',              'Ceintures & Maroquinerie', 16, 'accessoires', true);

-- ---------------------------------------------------------------------
-- 4. Les produits de `mode` vont dans `chaussures`
-- ---------------------------------------------------------------------
-- Le seul produit constaté le 2026-11-10 est « Air force Kobe Bryant »,
-- des baskets. Avant le trigger de la partie 7, qui l'accepterait de
-- toute façon (catégorie visible). `updated_at` avance (0002) : sans
-- effet sur le tri, qui suit `created_at`.
update public.products p
   set category_id = (select c.id from public.categories c where c.slug = 'chaussures')
 where p.category_id = (select c.id from public.categories c where c.slug = 'mode');

-- ---------------------------------------------------------------------
-- 5. Genre, tailles, couleurs
-- ---------------------------------------------------------------------
alter table public.products
  add column genre text
    constraint products_genre_check check (genre in ('femme', 'homme', 'enfant', 'mixte')),
  add column tailles text[] not null default '{}'
    constraint products_tailles_check check (
      cardinality(tailles) <= 25
      and array_position(tailles, null) is null
      and char_length(array_to_string(tailles, '')) <= 500),
  add column couleurs text[] not null default '{}'
    constraint products_couleurs_check check (
      cardinality(couleurs) <= 20
      and array_position(couleurs, null) is null
      and char_length(array_to_string(couleurs, '')) <= 400);

-- ---------------------------------------------------------------------
-- 6. Le commerçant écrit ces colonnes (0052 : droits colonne par colonne)
-- ---------------------------------------------------------------------
grant insert (genre, tailles, couleurs), update (genre, tailles, couleurs)
  on public.products to authenticated;

-- ---------------------------------------------------------------------
-- 7. Aucun produit n'entre dans une catégorie masquée
-- ---------------------------------------------------------------------
-- `security invoker` : `categories` est lisible par tous (0002). Fermé
-- par défaut : le refus tombe s'il n'existe pas de catégorie VISIBLE de
-- cet id (une policy future qui cacherait les catégories masquées ne
-- rouvrirait donc rien). Un id inexistant est refusé ici aussi, avant la
-- clé étrangère.
-- Nom `products_categorie_visible` : les triggers BEFORE s'exécutent par
-- ordre alphabétique, celui-ci passe avant `products_check_publishable`,
-- `products_masque_par_equipe_reste_masque` et `products_touch_updated_at`
-- (0002, 0046) ; chacun ne fait que refuser ou dater, l'ordre ne change
-- aucun résultat.
create or replace function public.produit_dans_une_categorie_visible()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.category_id is not distinct from old.category_id then
    return new;
  end if;
  if not exists (select 1 from public.categories c where c.id = new.category_id and c.visible) then
    raise exception 'Cette catégorie n''est plus proposée : choisissez une catégorie de la mode.';
  end if;
  return new;
end;
$$;

revoke execute on function public.produit_dans_une_categorie_visible() from public, anon, authenticated;

create trigger products_categorie_visible
  before insert or update of category_id on public.products
  for each row execute function public.produit_dans_une_categorie_visible();

-- ---------------------------------------------------------------------
-- 8. La recherche : catégories visibles, genre, taille, couleur, prix
-- ---------------------------------------------------------------------
-- Changer la liste des paramètres crée une autre fonction : on retire
-- l'ancienne pour que PostgREST n'ait jamais deux candidates (appel
-- ambigu). Rien en base ne dépend d'elle (aucune vue, aucune fonction).
drop function public.search_products(text, int, int, text, int, int);

create function public.search_products(
  p_query       text   default null,
  p_city_id     int    default null,
  p_category_id int    default null,
  p_sort        text   default 'recent',
  p_limit       int    default 24,
  p_offset      int    default 0,
  p_genre       text   default null,
  p_taille      text   default null,
  p_couleur     text   default null,
  p_prix_min    bigint default null,
  p_prix_max    bigint default null
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
  shop_photo_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.title, p.price_gnf, p.is_negotiable, p.status,
    p.category_id, cat.name,
    p.is_featured, p.contact_count, p.created_at,
    m.id, m.shop_name, c.id, c.name,
    img.storage_path,
    m.photo_path
  from public.products p
  join public.merchants  m on m.id = p.merchant_id
  join public.cities     c on c.id = m.city_id
  join public.categories cat on cat.id = p.category_id
  left join lateral (
    select storage_path
      from public.product_images
     where product_id = p.id
     order by position
     limit 1
  ) img on true
  where p.status in ('active', 'sold')
    and m.status = 'approved'
    and cat.visible
    and (p_city_id     is null or m.city_id     = p_city_id)
    and (p_category_id is null or p.category_id = p_category_id)
    and (
      p_genre is null
      or (p_genre in ('femme', 'homme') and (p.genre = p_genre or p.genre = 'mixte'))
      or (p_genre not in ('femme', 'homme') and p.genre = p_genre)
    )
    and (p_taille   is null or p_taille  = any (p.tailles))
    and (p_couleur  is null or p_couleur = any (p.couleurs))
    and (p_prix_min is null or p.price_gnf >= p_prix_min)
    and (p_prix_max is null or p.price_gnf <= p_prix_max)
    and (
      p_query is null or trim(p_query) = ''
      or extensions.unaccent(p.title)                    ilike '%' || extensions.unaccent(trim(p_query)) || '%'
      or extensions.unaccent(coalesce(p.description, '')) ilike '%' || extensions.unaccent(trim(p_query)) || '%'
      or extensions.unaccent(m.shop_name)                ilike '%' || extensions.unaccent(trim(p_query)) || '%'
    )
  order by
    p.is_featured desc,
    case when p_sort = 'popular' then p.contact_count end desc nulls last,
    p.created_at desc
  limit  least(coalesce(p_limit, 24), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Le `drop` a emporté les droits : on les rend, sans `public` (usage de
-- 0047 pour les fonctions du catalogue).
revoke execute on function public.search_products(text, int, int, text, int, int, text, text, text, bigint, bigint) from public;
grant execute on function public.search_products(text, int, int, text, int, int, text, text, text, bigint, bigint)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. Les produits sponsorisés : catégories visibles seulement
-- ---------------------------------------------------------------------
-- Dernière définition : 0047 (0069 n'en parle qu'en commentaire ;
-- constaté identique en production le 2026-11-10). Seul ajout :
-- `and cat.visible`. `create or replace` garde les droits.
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
         and cat.visible
         and (
           (p_category_id is null and ca.type = 'produit')
           or (p_category_id is not null and (
                (ca.type = 'categorie' and ca.category_id = p_category_id)
             or (ca.type = 'produit'   and p.category_id  = p_category_id)))
         )
         and (
           p_query is null or trim(p_query) = ''
           or extensions.unaccent(p.title)                    ilike '%' || extensions.unaccent(trim(p_query)) || '%'
           or extensions.unaccent(coalesce(p.description, '')) ilike '%' || extensions.unaccent(trim(p_query)) || '%'
           or extensions.unaccent(m.shop_name)                ilike '%' || extensions.unaccent(trim(p_query)) || '%'
         )
       order by m.id, random()
    ) s
   order by random()
   limit least(greatest(coalesce(p_limit, 2), 0), 4);
$$;
