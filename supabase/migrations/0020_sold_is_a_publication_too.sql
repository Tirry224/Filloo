-- =====================================================================
-- 0020 — « Vendu » est une publication, et passe par la même porte
-- =====================================================================
-- Trouvé le 2026-09-16 par un audit du contrôle de publication, puis
-- reproduit en base avant d'être corrigé.
--
-- Pourquoi 0020 et pas 0018 : le projet Supabase porte déjà
-- `0018_approve_a_shop_with_one_click` et
-- `0019_the_validation_switch_shows_its_state` (lues dans
-- `supabase_migrations.schema_migrations` le 2026-09-16), appliquées
-- sans que leur fichier ne soit commité. Le trou de numérotation est
-- délibéré : il marque leur place plutôt que de leur voler leur numéro,
-- ce qui rendrait la suite Git irrejouable sur le projet réel. Les
-- récupérer dans le dépôt est la tâche suivante, pas celle-ci.
--
-- LE PROBLÈME
-- Deux endroits décrivent la même notion — « ce produit est au
-- catalogue » — et ils ne disent pas la même chose :
--
--   - la policy « products: catalogue public » (0008, reprise par 0013)
--     publie `status in ('active', 'sold')` ;
--   - le trigger `products_check_publishable` (0002, partie 3.2) ne
--     vérifie QUE `new.status = 'active'`.
--
-- `sold` est donc un état publiquement visible que rien ne garde. Le
-- commerçant a le droit d'écrire `status` sur ses propres produits
-- (policy « products: je gere mes produits »), il lui suffit d'un PATCH
-- direct sur PostgREST pour faire passer un brouillon à `sold` sans
-- photo et sans boutique validée. Reproduit en base :
--
--   boutique 'pending', produit 'draft', zéro photo
--   → update products set status = 'active' → REFUSÉ (photo manquante)
--   → update products set status = 'sold'   → ACCEPTÉ
--
-- Ce que ça coûte, précisément. Tant que la boutique est 'pending', le
-- RLS masque encore le produit : `merchant_is_public` exige 'approved'.
-- La fuite n'est donc pas immédiate, elle est DIFFÉRÉE — le jour où
-- l'administrateur valide la boutique, ce produit apparaît au catalogue
-- sans avoir jamais satisfait une seule condition de publication, avec
-- une vignette vide. Et pour une boutique déjà approuvée, le
-- contournement est immédiat : 'draft' sans photo → 'sold' → visible.
-- C'est exactement l'invariant que 0011 avait été écrit pour tenir, par
-- une porte qu'il ne surveillait pas.
--
-- LA CORRECTION, ET POURQUOI PAS LA PLUS COURTE
-- La correction la plus courte serait `if new.status in ('active',
-- 'sold')`. Elle ferme bien le trou, mais elle en casse un usage
-- légitime : un produit publié dans les règles, dont la boutique est
-- ensuite refusée (0012) ou remise en attente, ne pourrait plus être
-- marqué vendu — son commerçant verrait « Votre boutique doit être
-- validée avant de publier » en cliquant sur « Marquer vendu », alors
-- qu'il ne publie rien. Le parcours 'rejected' n'a pas à être touché
-- par cette correction.
--
-- Ce qui doit être gardé n'est pas l'ÉTAT visible, c'est l'ENTRÉE dans
-- l'ensemble visible. Un produit déjà 'active' a franchi la porte ; le
-- faire passer à 'sold' ne le rend pas plus visible qu'il ne l'est
-- déjà. Un produit 'draft' ou 'hidden', lui, entre — et c'est là que la
-- vérification a toujours eu sa place.
--
-- Les transitions, après cette migration :
--   draft/hidden → active   vérifié  (inchangé)
--   draft/hidden → sold     vérifié  (LE TROU FERMÉ)
--   insert direct en active/sold     vérifié  (inchangé pour 'active')
--   active ↔ sold           libre    (déjà dans l'ensemble visible)
--   n'importe quoi → draft/hidden    libre    (on sort du catalogue)
--
-- La signification des statuts ne change pas, et `sold` reste public :
-- c'est la décision de 0008, un produit vendu s'affiche grisé plutôt que
-- de disparaître.

create or replace function public.check_product_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Écrit une fois ici plutôt que répété dans le `if` : le jour où un
  -- cinquième statut est ajouté à l'énumération, cette ligne et la
  -- policy « products: catalogue public » sont les deux seuls endroits
  -- à relire. C'est leur désaccord qui a créé cette faille.
  v_public_statuses public.product_status[] := array['active', 'sold'];
begin
  if new.status = any (v_public_statuses)
     -- Sur un INSERT il n'y a pas d'`old` : toute création directement
     -- dans un statut public est une entrée, donc vérifiée.
     and (tg_op = 'INSERT' or not (old.status = any (v_public_statuses)))
  then
    if not exists (
      select 1 from public.product_images where product_id = new.id
    ) then
      raise exception 'Un produit doit avoir au moins une photo pour être publié.';
    end if;

    if not exists (
      select 1 from public.merchants
      where id = new.merchant_id and status = 'approved'
    ) then
      raise exception 'Votre boutique doit être validée avant de publier.';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.check_product_publishable() is
  'Garde l''entrée dans le catalogue public (active ou sold) : au moins une photo, et une boutique approuvée. Les sorties et les mouvements internes à l''ensemble visible passent librement.';

-- Le trigger de 0002 n'est pas recréé : `create or replace function`
-- suffit, il pointe déjà sur ce nom. Sa clause `update of status` reste
-- correcte — une écriture qui ne mentionne pas `status` ne peut pas
-- faire entrer un produit au catalogue.
