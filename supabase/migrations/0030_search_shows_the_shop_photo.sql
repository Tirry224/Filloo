-- =====================================================================
-- 0030 — La recherche remonte la photo de la boutique
-- =====================================================================
-- Suite de 0029 : les cartes du fil et des résultats de recherche
-- affichent la photo de la boutique à côté de son nom. Ces cartes sont
-- nourries par `search_products`, qui ne renvoyait pas `photo_path`.
--
-- Rien d'autre ne change : le corps est celui de 0007, à une colonne
-- près. La colonne est ajoutée EN DERNIER, pour que le code déjà déployé,
-- qui ne la demande pas, continue de lire les autres sans surprise
-- pendant les minutes qui séparent la migration du déploiement.
--
-- Changer les colonnes renvoyées oblige à supprimer puis recréer la
-- fonction (`create or replace` le refuse) ; le droit d'exécution part
-- avec elle et se ré-accorde plus bas. Toujours `security invoker` (par
-- défaut) : le RLS de `merchants` continue de ne laisser passer que les
-- boutiques approuvées.

drop function if exists public.search_products(text, int, int, text, int, int);

create or replace function public.search_products(
  p_query       text default null,
  p_city_id     int  default null,
  p_category_id int  default null,
  p_sort        text default 'recent',
  p_limit       int  default 24,
  p_offset      int  default 0
)
returns table (
  product_id    uuid,
  title         text,
  price_gnf     bigint,
  is_negotiable boolean,
  status        public.product_status,
  category_id   int,
  category_name text,
  is_featured   boolean,
  contact_count int,
  created_at    timestamptz,
  merchant_id   uuid,
  shop_name     text,
  city_id       int,
  city_name     text,
  image_path    text,
  shop_photo_path text
)
language sql
stable
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
    and (p_city_id     is null or m.city_id     = p_city_id)
    and (p_category_id is null or p.category_id = p_category_id)
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

grant execute on function public.search_products(text, int, int, text, int, int)
  to anon, authenticated;
