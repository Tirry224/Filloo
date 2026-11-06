-- =====================================================================
-- 0046 : l'équipe modère, et garde l'historique de ce qu'elle fait
-- =====================================================================
-- Constaté le 2026-11-06 : l'équipe (`equipe`, 0042-0045) n'avait aucun
-- moyen, depuis /admin, de traiter un signalement (`reports`, 0001/0027)
-- ni de suspendre un compte (`profiles.is_suspended`, écrit seulement au
-- tableau de bord depuis 0002). Décisions du porteur du projet du
-- 2026-11-06 :
-- - tout membre de l'équipe peut suspendre et réactiver un compte ;
-- - une suspension porte un MOTIF obligatoire, que la personne suspendue
--   lit sur son écran « compte suspendu » ;
-- - chaque geste de l'équipe s'inscrit dans un historique ;
-- - les abonnements, plus tard (rien ici n'y touche).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Seule l'équipe suspend, réactive, masque un produit et classe un
--    signalement, et seulement par les fonctions ci-dessous : chacune
--    vérifie QUI demande (`je_suis_de_l_equipe()`), puis écrit
--    l'historique dans la même transaction. Pas de geste sans trace.
-- 2. `journal_equipe` ne s'écrit, ne se modifie et ne se supprime depuis
--    aucun écran : l'équipe la lit, les fonctions y ajoutent. L'auteur y
--    est signé par le serveur (`auth.uid()`), son nom copié au moment du
--    geste.
-- 3. Une suspension a un motif de 3 à 500 caractères, posé par l'équipe ;
--    la personne le lit (policy « je vois mes profils ») mais ne l'écrit
--    pas (`update` de `profiles` limité à `city_id` depuis 0037 ; la
--    policy d'insertion refuse un motif posé à la création).
-- 4. Un produit masqué PAR L'ÉQUIPE ne se republie pas par son
--    commerçant. Constaté le 2026-11-06 : `hidden` sert aussi au
--    commerçant, qui masque et republie lui-même ses produits (site :
--    `hideProductAction`/`republishProductAction` ; l'app installée fait
--    sans doute pareil). Bloquer `hidden → active` pour tous aurait cassé
--    ce geste légitime. Le masquage de l'équipe est donc une case à part,
--    `products.masque_par_equipe`, qui tient le produit en `hidden` tant
--    qu'elle est cochée ; le commerçant ne peut pas la décocher (aucun
--    droit `update` sur cette colonne). Le masquage du commerçant reste
--    inchangé.
-- 5. Un signalement classé dit par qui et ce qui a été décidé ; il ne se
--    classe qu'une fois. « Produit masqué » ou « compte suspendu » n'est
--    accepté que si la sanction est réellement en place : l'historique ne
--    ment pas sur ce qui a été fait.
-- 6. L'équipe ne lit une conversation privée que si elle a été SIGNALÉE
--    (le signaleur a été prévenu : « Notre équipe va lire cette
--    conversation »), par `messages_signales`, 50 derniers messages. Aucune
--    policy de `messages` ni de `conversations` ne s'ouvre à l'équipe.
--
-- CHOIX
-- - Fonctions `security definer` plutôt que policies d'écriture pour
--   l'équipe : une policy ne sait pas écrire l'historique, et elle
--   ouvrirait toutes les colonnes de `profiles` à l'écriture.
-- - L'équipe ne lit pas `profiles` ni `conversations` à travers le RLS :
--   les trois fonctions de lecture rendent juste ce qu'il faut pour
--   décider.
-- - Pas de fonction pour « démasquer » un produit : non demandée. Lever
--   un masquage de l'équipe = tableau de bord (`service_role`) en
--   attendant.
-- - `journal_equipe` n'a pas de déclencheur qui refuse aussi le tableau
--   de bord : la clé `on delete set null` vers `equipe` doit pouvoir
--   effacer l'auteur, et une demande d'effacement doit rester possible.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE : uniquement des AJOUTS (colonnes
-- nullables ou à défaut, une table, des fonctions, une policy de lecture).
-- Les deux policies réécrites (insertion de `profiles` et de `reports`)
-- n'ajoutent qu'une condition sur une colonne NOUVELLE, que l'app ne
-- connaît pas et n'envoie donc jamais.


-- ---------------------------------------------------------------------
-- 1. Le motif de suspension
-- ---------------------------------------------------------------------
alter table public.profiles
  add column suspension_reason text
  constraint profiles_motif_de_suspension_borne
  check (suspension_reason is null or char_length(btrim(suspension_reason)) between 3 and 500);

comment on column public.profiles.suspension_reason is
  'Motif de la suspension, écrit par l''équipe (suspendre_profil) et montré à la personne suspendue.';

-- Une session a `insert` sur toute la table (défaut Supabase, constaté le
-- 2026-10-23) : sans cette condition, on se créerait un second compte
-- portant déjà un « motif de suspension ». Reprise entière de 0041.
alter policy "profiles: je cree mon second compte" on public.profiles
  with check (
    auth_user_id = (select auth.uid())
    and is_deleted = false
    and not public.my_role_is_suspended(role)
    and suspension_reason is null
  );


-- ---------------------------------------------------------------------
-- 2. L'historique de l'équipe
-- ---------------------------------------------------------------------
create table public.journal_equipe (
  id          uuid primary key default gen_random_uuid(),
  auteur      uuid references public.equipe(auth_user_id) on delete set null,
  -- Copié au moment du geste : un collègue parti de l'équipe garde son
  -- nom dans l'historique.
  auteur_nom  text not null,
  action      text not null
              check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement')),
  cible_type  text not null check (cible_type in ('profil', 'produit', 'signalement')),
  cible_id    uuid not null,
  motif       text check (motif is null or char_length(motif) <= 500),
  created_at  timestamptz not null default now()
);

comment on table public.journal_equipe is
  'Historique des gestes de l''équipe. Écrit SEULEMENT par les fonctions de modération (0046).';

create index journal_equipe_recent_idx on public.journal_equipe (created_at desc);

alter table public.journal_equipe enable row level security;

-- Le défaut Supabase accorde tout à `anon` et `authenticated` sur une
-- nouvelle table : on retire ce qu'aucun écran ne doit faire. Le RLS
-- seul suffirait (aucune policy d'écriture), mais un droit retiré se
-- lit sans avoir à prouver l'absence d'une policy.
revoke all on public.journal_equipe from anon;
revoke insert, update, delete, truncate, references, trigger on public.journal_equipe from authenticated;

create policy "journal_equipe: l'equipe le lit"
  on public.journal_equipe for select
  to authenticated
  using ((select public.je_suis_de_l_equipe()));


-- ---------------------------------------------------------------------
-- 3. Un signalement classé dit par qui et ce qui a été décidé
-- ---------------------------------------------------------------------
alter table public.reports
  add column handled_by uuid references public.equipe(auth_user_id) on delete set null,
  add column decision   text
             check (decision in ('sans_suite', 'produit_masque', 'compte_suspendu'));

-- Les signalements classés par 0027 (doublons) n'ont pas de décision :
-- la règle ne va que dans un sens.
alter table public.reports
  add constraint reports_une_decision_est_un_traitement
  check (decision is null or handled_at is not null);

create index reports_a_traiter_idx on public.reports (created_at desc) where handled_at is null;

-- Le signaleur ne pose ni décision ni auteur à sa place. Reprise entière
-- de 0002 (aucune migration ne l'avait réécrite, constaté en production
-- le 2026-11-06).
alter policy "reports: je signale" on public.reports
  with check (
    public.owns_profile(reporter_id)
    and public.is_active_profile(reporter_id)
    and handled_by is null
    and decision is null
  );

create policy "reports: l'equipe les lit"
  on public.reports for select
  to authenticated
  using ((select public.je_suis_de_l_equipe()));


-- ---------------------------------------------------------------------
-- 4. Le masquage de l'équipe tient le produit masqué
-- ---------------------------------------------------------------------
-- Le commerçant a `update` sur `status` (0002) et `insert` sur toute la
-- table (défaut Supabase) ; il n'a PAS `update` sur cette colonne, ajoutée
-- après la liste blanche. Il peut donc toujours modifier le texte, le
-- prix ou supprimer son produit masqué, jamais le remettre en ligne.
alter table public.products
  add column masque_par_equipe boolean not null default false;

comment on column public.products.masque_par_equipe is
  'Coché par masquer_produit (équipe) : le produit reste « hidden » ; le commerçant ne le republie pas.';

create or replace function public.produit_masque_par_equipe_reste_masque()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.masque_par_equipe and new.status <> 'hidden' then
    raise exception 'Ce produit a été masqué par l''équipe Filloo. Écrivez-lui pour en parler.';
  end if;
  return new;
end;
$$;

revoke execute on function public.produit_masque_par_equipe_reste_masque() from public, anon, authenticated;

create trigger products_masque_par_equipe_reste_masque
  before insert or update on public.products
  for each row execute function public.produit_masque_par_equipe_reste_masque();


-- ---------------------------------------------------------------------
-- 5. Les gestes de l'équipe
-- ---------------------------------------------------------------------
-- Toutes : `security definer` (elles écrivent des colonnes qu'aucun écran
-- n'écrit), refus si l'appelant n'est pas de l'équipe, historique écrit
-- dans la même transaction. L'auteur est lu dans `equipe` par
-- `auth.uid()` : personne ne signe au nom d'un autre.

create or replace function public.suspendre_profil(p_profile uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif     text := btrim(coalesce(p_motif, ''));
  v_suspendu  boolean;
  v_supprime  boolean;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select p.is_suspended, p.is_deleted into v_suspendu, v_supprime
    from public.profiles p where p.id = p_profile
     for update;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  if v_supprime then
    raise exception 'Ce compte est supprimé.';
  end if;
  if v_suspendu then
    raise exception 'Ce compte est déjà suspendu.';
  end if;

  -- Le déclencheur de 0021 (`profiles_queue_suspension`) enfile la
  -- notification ; 0017/0022 gèlent les fils en lisant `is_suspended`.
  update public.profiles
     set is_suspended = true, suspension_reason = v_motif, suspended_at = now()
   where id = p_profile;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'suspendre', 'profil', p_profile, v_motif
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.suspendre_profil(uuid, text) from public, anon;
grant execute on function public.suspendre_profil(uuid, text) to authenticated;


-- Le motif reste interne (historique) : la personne constate seulement
-- qu'elle peut de nouveau écrire. Un compte supprimé et suspendu peut
-- être réactivé : c'est ce qui lui permet de recréer son compte (0041).
create or replace function public.reactiver_profil(p_profile uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif     text := btrim(coalesce(p_motif, ''));
  v_suspendu  boolean;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select p.is_suspended into v_suspendu
    from public.profiles p where p.id = p_profile
     for update;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  if not v_suspendu then
    raise exception 'Ce compte n''est pas suspendu.';
  end if;

  update public.profiles
     set is_suspended = false, suspension_reason = null, suspended_at = null
   where id = p_profile;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'reactiver', 'profil', p_profile, v_motif
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.reactiver_profil(uuid, text) from public, anon;
grant execute on function public.reactiver_profil(uuid, text) to authenticated;


-- Sans effet (et sans ligne d'historique) sur un produit déjà masqué par
-- l'équipe : le site peut la rappeler sans risque après un essai
-- interrompu. Un produit masqué par son commerçant, lui, passe sous le
-- masquage de l'équipe.
create or replace function public.masquer_produit(p_product uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif   text := btrim(coalesce(p_motif, ''));
  v_masque  boolean;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select pr.masque_par_equipe into v_masque
    from public.products pr where pr.id = p_product
     for update;
  if not found then
    raise exception 'Produit introuvable.';
  end if;
  if v_masque then
    return;
  end if;

  update public.products
     set status = 'hidden', masque_par_equipe = true
   where id = p_product;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'masquer_produit', 'produit', p_product, v_motif
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.masquer_produit(uuid, text) from public, anon;
grant execute on function public.masquer_produit(uuid, text) to authenticated;


create or replace function public.traiter_signalement(p_report uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_decision is null or p_decision not in ('sans_suite', 'produit_masque', 'compte_suspendu') then
    raise exception 'Décision inconnue.';
  end if;

  select * into v_report from public.reports r where r.id = p_report for update;
  if not found then
    raise exception 'Signalement introuvable.';
  end if;
  if v_report.handled_at is not null then
    raise exception 'Ce signalement a déjà été traité.';
  end if;

  -- L'historique ne dit pas « produit masqué » si le produit ne l'est pas.
  if p_decision = 'produit_masque' and not (
       v_report.target_type = 'product'
       and exists (select 1 from public.products pr
                    where pr.id = v_report.target_id and pr.masque_par_equipe)
     ) then
    raise exception 'Masquez d''abord le produit.';
  end if;

  -- Ni « compte suspendu » si aucun des comptes en cause ne l'est.
  if p_decision = 'compte_suspendu' and not exists (
       select 1 from public.profiles p
        where p.is_suspended
          and p.id in (
            select m.profile_id from public.products pr
              join public.merchants m on m.id = pr.merchant_id
             where v_report.target_type = 'product' and pr.id = v_report.target_id
            union all
            select m.profile_id from public.merchants m
             where v_report.target_type = 'merchant' and m.id = v_report.target_id
            union all
            select c.client_id from public.conversations c
             where v_report.target_type = 'conversation' and c.id = v_report.target_id
            union all
            select m.profile_id from public.conversations c
              join public.merchants m on m.id = c.merchant_id
             where v_report.target_type = 'conversation' and c.id = v_report.target_id
          )
     ) then
    raise exception 'Suspendez d''abord le compte en cause.';
  end if;

  update public.reports
     set handled_at = now(), handled_by = (select auth.uid()), decision = p_decision
   where id = p_report;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'classer_signalement', 'signalement', p_report, p_decision
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.traiter_signalement(uuid, text) from public, anon;
grant execute on function public.traiter_signalement(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Ce que l'équipe lit pour décider
-- ---------------------------------------------------------------------
-- Les noms : `profiles.full_name` (il n'y a pas d'autre nom affiché) et
-- `merchants.shop_name`. Les colonnes de sortie sont qualifiées partout :
-- en plpgsql, un nom de sortie (`id`, `created_at`…) est aussi une
-- variable, qui masquerait la colonne du même nom.

create or replace function public.signalements_a_traiter()
returns table (
  id                       uuid,
  created_at               timestamptz,
  target_type              text,
  target_id                uuid,
  reason                   text,
  reporter_id              uuid,
  reporter_nom             text,
  produit_titre            text,
  produit_status           text,
  merchant_profile_id      uuid,
  shop_name                text,
  conv_client_profile_id   uuid,
  conv_client_nom          text,
  conv_merchant_profile_id uuid,
  conv_shop_name           text
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
  select r.id,
         r.created_at,
         r.target_type::text,
         r.target_id,
         r.reason,
         r.reporter_id,
         rp.full_name,
         pr.title,
         pr.status::text,
         coalesce(pm.profile_id, tm.profile_id),
         coalesce(pm.shop_name, tm.shop_name),
         c.client_id,
         cp.full_name,
         cm.profile_id,
         cm.shop_name
    from public.reports r
    join public.profiles rp on rp.id = r.reporter_id
    left join public.products pr       on r.target_type = 'product'      and pr.id = r.target_id
    left join public.merchants pm      on pm.id = pr.merchant_id
    left join public.merchants tm      on r.target_type = 'merchant'     and tm.id = r.target_id
    left join public.conversations c   on r.target_type = 'conversation' and c.id = r.target_id
    left join public.profiles cp       on cp.id = c.client_id
    left join public.merchants cm      on cm.id = c.merchant_id
   where r.handled_at is null
   order by r.created_at desc, r.id;
end;
$$;

revoke execute on function public.signalements_a_traiter() from public, anon;
grant execute on function public.signalements_a_traiter() to authenticated;


-- Seule porte de l'équipe vers une conversation privée : un signalement
-- de CETTE conversation. Pas limitée aux signalements en attente : un
-- signalement classé se relit avec ce qui a motivé la décision.
create or replace function public.messages_signales(p_report uuid)
returns table (id uuid, sender_id uuid, body text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conversation uuid;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  select r.target_id into v_conversation
    from public.reports r
   where r.id = p_report and r.target_type = 'conversation';
  if not found then
    raise exception 'Ce signalement ne vise pas une conversation.';
  end if;

  return query
  select m.id, m.sender_id, m.body, m.created_at
    from public.messages m
   where m.conversation_id = v_conversation
   order by m.created_at desc, m.id desc
   limit 50;
end;
$$;

revoke execute on function public.messages_signales(uuid) from public, anon;
grant execute on function public.messages_signales(uuid) to authenticated;


-- Les comptes à réactiver : suspendus et non supprimés (un compte
-- supprimé n'a plus de nom à montrer).
create or replace function public.comptes_suspendus()
returns table (profile_id uuid, role text, nom text, shop_name text, suspension_reason text)
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
  select p.id, p.role::text, p.full_name, m.shop_name, p.suspension_reason
    from public.profiles p
    left join public.merchants m on m.profile_id = p.id
   where p.is_suspended and not p.is_deleted
   order by p.suspended_at desc nulls last, p.id;
end;
$$;

revoke execute on function public.comptes_suspendus() from public, anon;
grant execute on function public.comptes_suspendus() to authenticated;
