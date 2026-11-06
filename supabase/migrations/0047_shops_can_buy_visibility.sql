-- =====================================================================
-- 0047 : une boutique peut demander de la visibilité, l'équipe la valide
-- =====================================================================
-- Étape 2 du document de monétisation du porteur du projet (2026-11-06) :
-- la publicité, SANS paiement pour l'instant. Pas de prix, pas de
-- crédits : l'équipe valide chaque campagne à la main. Trois types :
-- - « produit »   : un produit mieux placé dans les résultats pertinents
--                   et à l'accueil ;
-- - « boutique »  : la boutique dans « Boutiques à découvrir » ;
-- - « categorie » : un produit promu dans UNE catégorie.
-- Le site affiche « Sponsorisé » ; le paiement viendra plus tard.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Une campagne ne s'écrit que par les fonctions ci-dessous : aucun
--    écran n'a `insert`, `update` ni `delete` sur `campagnes`. Le
--    commerçant lit les siennes, l'équipe lit tout.
-- 2. Seule une boutique en ligne (profil commerçant non supprimé, non
--    suspendu) demande une campagne, pour SON produit publié ; trois
--    campagnes au plus en attente ou en cours, jamais deux identiques.
-- 3. Seule l'équipe valide, refuse (motif obligatoire) ou interrompt
--    (motif obligatoire), et chaque geste s'inscrit dans `journal_equipe`.
-- 4. Une campagne n'est montrée que pendant sa période, et seulement si
--    le produit est toujours publié et la boutique toujours en ligne :
--    une suspension, un masquage de l'équipe ou un produit retiré coupent
--    la publicité aussitôt, sans geste de plus.
-- 5. « Terminée » n'est pas un statut : c'est une campagne « active »
--    dont `fin_at` est passée. Rien ne tourne la nuit pour la fermer.
--
-- CHOIX
-- - `fin_at` d'une campagne annulée ou interrompue en cours devient
--   l'instant de l'arrêt : c'est la seule colonne qui dise quand elle a
--   cessé d'être montrée (`decidee_par`/`decidee_at` restent ceux de la
--   validation ; l'interruption est signée dans `journal_equipe`).
-- - Une campagne « categorie » ne sort QUE dans sa catégorie : sans
--   `p_category_id`, `produits_sponsorises` ne rend que des campagnes
--   « produit ». La catégorie promue n'est pas forcée à celle du
--   produit : l'équipe juge à la validation.
-- - Valider vérifie de nouveau que le produit est publié et la boutique
--   en ligne : sinon la durée courrait pour une publicité invisible.
-- - Le critère texte de `produits_sponsorises` est COPIÉ de
--   `search_products` (0030) plutôt qu'appelé : appeler la recherche
--   ramènerait sa limite de 50 et son tri, et la modifier toucherait la
--   fonction que l'app installée appelle. Un test vérifie que les deux
--   donnent le même verdict.
-- - Les deux fonctions publiques sont `security definer` (le RLS de
--   `campagnes` ne laisse rien voir à `anon`) : elles refont donc À LA
--   MAIN les règles du catalogue public (0013 `merchant_is_public`, 0046
--   `masque_par_equipe`). Plus strictes que le catalogue : un produit
--   « vendu » n'est pas sponsorisé.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE : uniquement des AJOUTS (une table,
-- une colonne nullable dans `analytics_events`, des fonctions). Les deux
-- contraintes de `journal_equipe` sont élargies, jamais resserrées. Aucune
-- table, colonne, policy ou fonction que l'app lit n'est touchée.


-- ---------------------------------------------------------------------
-- 1. Les campagnes
-- ---------------------------------------------------------------------
create table public.campagnes (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references public.merchants(id) on delete cascade,
  type         text not null check (type in ('produit', 'boutique', 'categorie')),
  product_id   uuid references public.products(id) on delete cascade,
  category_id  int references public.categories(id),
  duree_jours  int not null check (duree_jours in (3, 7, 14, 30)),
  statut       text not null default 'en_attente'
               check (statut in ('en_attente', 'active', 'refusee', 'annulee', 'interrompue')),
  debut_at     timestamptz,
  fin_at       timestamptz,
  -- Motif de refus ou d'interruption.
  motif        text check (motif is null or char_length(motif) between 3 and 500),
  decidee_par  uuid references public.equipe(auth_user_id) on delete set null,
  decidee_at   timestamptz,
  created_at   timestamptz not null default now(),

  constraint campagnes_cible_selon_le_type check (
       (type = 'produit'   and product_id is not null and category_id is null)
    or (type = 'categorie' and product_id is not null and category_id is not null)
    or (type = 'boutique'  and product_id is null     and category_id is null)
  ),
  constraint campagnes_active_a_une_periode check (
    statut <> 'active' or (debut_at is not null and fin_at is not null)
  ),
  constraint campagnes_refus_et_interruption_motives check (
    statut not in ('refusee', 'interrompue') or motif is not null
  )
);

comment on table public.campagnes is
  'Publicité (0047). Écrite SEULEMENT par demander_campagne, annuler_campagne, decider_campagne, interrompre_campagne. « Terminée » = active et fin_at passée.';

create index campagnes_par_boutique_idx on public.campagnes (merchant_id, created_at desc);
create index campagnes_par_produit_idx on public.campagnes (product_id) where product_id is not null;
create index campagnes_par_categorie_idx on public.campagnes (category_id) where category_id is not null;
create index campagnes_en_cours_idx on public.campagnes (type, fin_at) where statut = 'active';

alter table public.campagnes enable row level security;

-- Le défaut Supabase accorde tout sur une nouvelle table : on retire
-- l'écriture, pour que l'absence de policy ne soit pas la seule barrière.
revoke all on public.campagnes from anon;
revoke insert, update, delete, truncate, references, trigger on public.campagnes from authenticated;

-- Une seule policy de lecture (pas deux permissives qui s'additionnent).
create policy "campagnes: la boutique lit les siennes, l'equipe tout"
  on public.campagnes for select
  to authenticated
  using (
    merchant_id = (select public.my_merchant_id())
    or (select public.je_suis_de_l_equipe())
  );


-- ---------------------------------------------------------------------
-- 2. L'historique de l'équipe connaît les campagnes
-- ---------------------------------------------------------------------
-- Noms des contraintes constatés en production le 2026-11-06
-- (`pg_constraint`) : noms par défaut de 0046, gardés.
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne'));

alter table public.journal_equipe drop constraint journal_equipe_cible_type_check;
alter table public.journal_equipe add constraint journal_equipe_cible_type_check
  check (cible_type in ('profil', 'produit', 'signalement', 'campagne'));


-- ---------------------------------------------------------------------
-- 3. Les mesures d'une campagne
-- ---------------------------------------------------------------------
-- Le site écrit (service_role, comme aujourd'hui) `pub_vue` et `pub_clic`
-- avec la campagne. Une campagne supprimée (boutique supprimée) laisse
-- ses mesures, anonymes.
alter table public.analytics_events
  add column campagne_id uuid references public.campagnes(id) on delete set null;

create index analytics_events_par_campagne_idx
  on public.analytics_events (campagne_id, name) where campagne_id is not null;


-- ---------------------------------------------------------------------
-- 4. Le commerçant demande, annule
-- ---------------------------------------------------------------------
-- Valeurs par défaut (`null`) sur les trois derniers paramètres : le site
-- omet `p_product` et `p_category` quand ils ne servent pas (supabase-js
-- retire une clé `undefined`), et PostgREST ne trouve une fonction que si
-- chaque paramètre absent a un défaut. Postgres impose alors un défaut à
-- `p_duree` aussi ; une durée absente est refusée plus bas.
create or replace function public.demander_campagne(
  p_type     text,
  p_product  uuid default null,
  p_category int  default null,
  p_duree    int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant uuid;
  v_id       uuid;
begin
  -- La boutique de l'appelant, en ligne. Verrouillée : deux demandes
  -- simultanées ne franchissent pas ensemble le plafond ni le doublon.
  select m.id into v_merchant
    from public.merchants m
    join public.profiles p on p.id = m.profile_id
   where p.auth_user_id = (select auth.uid())
     and p.role = 'merchant'
     and m.status = 'approved'
     and not p.is_deleted
     and not p.is_suspended
     for update of m;
  if v_merchant is null then
    raise exception 'Réservé aux boutiques en ligne.';
  end if;

  if p_type is null or p_type not in ('produit', 'boutique', 'categorie') then
    raise exception 'Type de campagne inconnu.';
  end if;
  if p_duree is null or p_duree not in (3, 7, 14, 30) then
    raise exception 'Durée possible : 3, 7, 14 ou 30 jours.';
  end if;

  if p_type = 'boutique' then
    if p_product is not null or p_category is not null then
      raise exception 'Une campagne boutique ne vise ni produit ni catégorie.';
    end if;
  else
    if p_product is null then
      raise exception 'Choisissez un produit.';
    end if;
    if not exists (select 1 from public.products pr
                    where pr.id = p_product
                      and pr.merchant_id = v_merchant
                      and pr.status = 'active'
                      and not pr.masque_par_equipe) then
      raise exception 'Ce produit n''est pas publié dans votre boutique.';
    end if;
    if p_type = 'produit' and p_category is not null then
      raise exception 'Une campagne produit ne vise pas de catégorie.';
    end if;
    if p_type = 'categorie' then
      if p_category is null then
        raise exception 'Choisissez une catégorie.';
      end if;
      if not exists (select 1 from public.categories cat where cat.id = p_category) then
        raise exception 'Catégorie introuvable.';
      end if;
    end if;
  end if;

  if (select count(*) from public.campagnes c
       where c.merchant_id = v_merchant
         and (c.statut = 'en_attente' or (c.statut = 'active' and c.fin_at > now()))) >= 3 then
    raise exception 'Trois campagnes au plus en même temps.';
  end if;

  if exists (select 1 from public.campagnes c
              where c.merchant_id = v_merchant
                and c.type = p_type
                and c.product_id is not distinct from p_product
                and c.category_id is not distinct from p_category
                and (c.statut = 'en_attente' or (c.statut = 'active' and c.fin_at > now()))) then
    raise exception 'Cette campagne est déjà en attente ou en cours.';
  end if;

  insert into public.campagnes (merchant_id, type, product_id, category_id, duree_jours)
  values (v_merchant, p_type, p_product, p_category, p_duree)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.demander_campagne(text, uuid, int, int) from public, anon;
grant execute on function public.demander_campagne(text, uuid, int, int) to authenticated;


-- Un commerçant suspendu peut encore annuler : retirer sa publicité ne
-- fait de tort à personne. Une campagne d'autrui est « introuvable ».
create or replace function public.annuler_campagne(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.campagnes%rowtype;
begin
  select * into v_c from public.campagnes c
   where c.id = p_id and c.merchant_id = public.my_merchant_id()
     for update;
  if not found then
    raise exception 'Campagne introuvable.';
  end if;

  if v_c.statut = 'en_attente' then
    update public.campagnes set statut = 'annulee' where id = p_id;
  elsif v_c.statut = 'active' and v_c.fin_at > now() then
    update public.campagnes set statut = 'annulee', fin_at = now() where id = p_id;
  else
    raise exception 'Cette campagne ne peut plus être annulée.';
  end if;
end;
$$;

revoke execute on function public.annuler_campagne(uuid) from public, anon;
grant execute on function public.annuler_campagne(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5. L'équipe décide, interrompt
-- ---------------------------------------------------------------------
-- `p_motif` par défaut `null` : le site l'omet pour une validation.
create or replace function public.decider_campagne(p_id uuid, p_accepter boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c     public.campagnes%rowtype;
  v_motif text := btrim(coalesce(p_motif, ''));
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_accepter is null then
    raise exception 'Acceptez ou refusez.';
  end if;

  select * into v_c from public.campagnes c where c.id = p_id for update;
  if not found then
    raise exception 'Campagne introuvable.';
  end if;
  if v_c.statut <> 'en_attente' then
    raise exception 'Cette campagne a déjà été décidée.';
  end if;

  if p_accepter then
    if not public.merchant_is_public(v_c.merchant_id) then
      raise exception 'Cette boutique n''est plus en ligne.';
    end if;
    if v_c.product_id is not null and not exists (
         select 1 from public.products pr
          where pr.id = v_c.product_id and pr.status = 'active' and not pr.masque_par_equipe) then
      raise exception 'Ce produit n''est plus publié.';
    end if;

    update public.campagnes
       set statut = 'active',
           debut_at = now(),
           fin_at = now() + make_interval(days => v_c.duree_jours),
           decidee_par = (select auth.uid()),
           decidee_at = now()
     where id = p_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'valider_campagne', 'campagne', p_id, null
      from public.equipe e where e.auth_user_id = (select auth.uid());
  else
    if char_length(v_motif) not between 3 and 500 then
      raise exception 'Le motif fait de 3 à 500 caractères.';
    end if;

    update public.campagnes
       set statut = 'refusee',
           motif = v_motif,
           decidee_par = (select auth.uid()),
           decidee_at = now()
     where id = p_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'refuser_campagne', 'campagne', p_id, v_motif
      from public.equipe e where e.auth_user_id = (select auth.uid());
  end if;
end;
$$;

revoke execute on function public.decider_campagne(uuid, boolean, text) from public, anon;
grant execute on function public.decider_campagne(uuid, boolean, text) to authenticated;


create or replace function public.interrompre_campagne(p_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c     public.campagnes%rowtype;
  v_motif text := btrim(coalesce(p_motif, ''));
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select * into v_c from public.campagnes c where c.id = p_id for update;
  if not found then
    raise exception 'Campagne introuvable.';
  end if;
  if not (v_c.statut = 'active' and v_c.fin_at > now()) then
    raise exception 'Seule une campagne en cours s''interrompt.';
  end if;

  update public.campagnes
     set statut = 'interrompue', motif = v_motif, fin_at = now()
   where id = p_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'interrompre_campagne', 'campagne', p_id, v_motif
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.interrompre_campagne(uuid, text) from public, anon;
grant execute on function public.interrompre_campagne(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Ce que le public voit
-- ---------------------------------------------------------------------
-- Mêmes colonnes que `search_products` (0030), plus `campagne_id` en
-- dernier. Règles de visibilité refaites à la main (security definer) :
-- campagne active dans sa période, produit publié et non masqué par
-- l'équipe, boutique en ligne (0013 : approuvée, propriétaire ni
-- suspendu ni supprimé). Un produit par boutique, tirage au sort entre
-- annonceurs, 4 au plus.
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
   limit least(greatest(coalesce(p_limit, 2), 0), 4);
$$;

revoke execute on function public.produits_sponsorises(text, int, int) from public;
grant execute on function public.produits_sponsorises(text, int, int) to anon, authenticated;


create or replace function public.boutiques_mises_en_avant(p_limit int default 6)
returns table (
  campagne_id     uuid,
  merchant_id     uuid,
  shop_name       text,
  city_name       text,
  shop_photo_path text,
  produits_actifs int
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.campagne_id, s.merchant_id, s.shop_name, s.city_name, s.shop_photo_path, s.produits_actifs
    from (
      select distinct on (m.id)
             ca.id        as campagne_id,
             m.id         as merchant_id,
             m.shop_name  as shop_name,
             ci.name      as city_name,
             m.photo_path as shop_photo_path,
             n.produits_actifs
        from public.campagnes ca
        join public.merchants m  on m.id = ca.merchant_id
        join public.profiles  pf on pf.id = m.profile_id
        join public.cities    ci on ci.id = m.city_id
        cross join lateral (
          select count(*)::int as produits_actifs
            from public.products p
           where p.merchant_id = m.id and p.status = 'active' and not p.masque_par_equipe
        ) n
       where ca.type = 'boutique'
         and ca.statut = 'active'
         and ca.debut_at <= now() and now() < ca.fin_at
         and m.status = 'approved'
         and not pf.is_suspended
         and not pf.is_deleted
         and n.produits_actifs > 0
       order by m.id, random()
    ) s
   order by random()
   limit least(greatest(coalesce(p_limit, 6), 0), 12);
$$;

revoke execute on function public.boutiques_mises_en_avant(int) from public;
grant execute on function public.boutiques_mises_en_avant(int) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. Les résultats, et la file de l'équipe
-- ---------------------------------------------------------------------
-- Une campagne sans mesure rend 0 vue, 0 clic. Les mesures de plus de
-- 13 mois sont purgées (0028) : les chiffres d'une très vieille campagne
-- baissent.
create or replace function public.resultats_campagnes()
returns table (campagne_id uuid, vues bigint, clics bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         count(e.id) filter (where e.name = 'pub_vue'),
         count(e.id) filter (where e.name = 'pub_clic')
    from public.campagnes c
    left join public.analytics_events e on e.campagne_id = c.id
   where c.merchant_id = (select public.my_merchant_id())
      or (select public.je_suis_de_l_equipe())
   group by c.id;
$$;

revoke execute on function public.resultats_campagnes() from public, anon;
grant execute on function public.resultats_campagnes() to authenticated;


-- L'équipe juge une campagne en attente sur un produit qu'elle ne voit pas
-- forcément par le catalogue (boutique suspendue, produit retiré
-- depuis) : titre et boutique lus ici, sans ouvrir `products` à l'équipe.
create or replace function public.campagnes_equipe()
returns table (
  id            uuid,
  type          text,
  statut        text,
  duree_jours   int,
  debut_at      timestamptz,
  fin_at        timestamptz,
  motif         text,
  created_at    timestamptz,
  merchant_id   uuid,
  shop_name     text,
  product_id    uuid,
  produit_titre text,
  category_id   int,
  category_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  return query
  select c.id, c.type, c.statut, c.duree_jours, c.debut_at, c.fin_at, c.motif, c.created_at,
         m.id, m.shop_name, pr.id, pr.title, cat.id, cat.name
    from public.campagnes c
    join public.merchants m        on m.id = c.merchant_id
    left join public.products pr   on pr.id = c.product_id
    left join public.categories cat on cat.id = c.category_id
   order by c.created_at desc, c.id
   limit 200;
end;
$$;

revoke execute on function public.campagnes_equipe() from public, anon;
grant execute on function public.campagnes_equipe() to authenticated;
