-- =====================================================================
-- 0060 : une boutique achète des crédits et paie sa publicité avec
-- =====================================================================
-- Décisions du porteur du projet du 2026-11-07 : 1 crédit = 1 000 GNF ;
-- packs de 10, 25 ou 50 crédits sans bonus ; un crédit acheté vaut 12
-- mois ; Business en reçoit chaque mois (10 par défaut, réglable par
-- l'équipe), PERDUS à la fin de la période ; les crédits paient la
-- publicité (prix / 1 000). Tout le monde (Gratuit, Pro, Business) en
-- achète. Paiement à la main, EXACTEMENT comme 0058 et 0059 : mêmes
-- colonnes `paiement_*`, mêmes moyens actifs, même vérification.
-- Branche `monetisation` : NE S'APPLIQUE PAS avant que le porteur du
-- projet publie cette branche, et JAMAIS sans 0058 et 0059.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Un crédit vit dans un LOT (`lots_credits`) : un achat validé, une
--    période d'abonnement, ou un geste de l'équipe. Aucun écran n'écrit
--    un lot, une consommation ni un achat : seulement les fonctions
--    ci-dessous. La boutique lit les siens, l'équipe tout.
-- 2. Un crédit n'est dépensable que si son lot est disponible
--    (`disponible_at <= now() < expire_at`). Un lot ne descend jamais
--    sous zéro ni ne dépasse ce qu'il avait au départ (contraintes).
-- 3. Payer une campagne en crédits prend d'abord les lots qui expirent le
--    plus tôt, et chaque prise est notée (`consommations_credits`). Deux
--    paiements simultanés de la même boutique ne dépensent pas deux fois
--    le même crédit (boutique verrouillée).
-- 4. Une campagne payée en crédits refusée, annulée avant son début, ou
--    supprimée avant son début (produit supprimé) rend ses crédits à
--    LEURS lots, avec leur expiration d'origine. Commencée, rien ne
--    revient. Elle ne se rembourse jamais en argent.
-- 5. Un abonnement qui devient actif, par n'importe quel chemin, apporte
--    les crédits inclus de sa formule pour sa période exacte ; s'il est
--    interrompu, son lot expire à l'instant.
-- 6. L'argent des crédits est compté UNE fois, à l'achat
--    (`revenus_credits`) : `revenus_publicite` ne compte plus une
--    campagne payée en crédits.
--
-- CHOIX
-- - Les crédits inclus suivent la FORMULE (`tarifs_abonnement.
--   credits_inclus`), Pro compris s'il en reçoit un jour ; ils sont lus
--   à l'ACTIVATION, pas figés à la demande (contrairement au prix).
-- - Les crédits d'abonnement s'arrêtent à `fin_at`, sans les 7 jours de
--   grâce de `formule_de` (« perdus à la fin de la période »).
-- - Un abonnement validé d'avance (renouvellement anticipé) a un lot
--   visible mais pas encore disponible (`disponible_at` = son début).
-- - Une campagne payée en crédits garde `paiement_reference` et
--   `paiement_numero` vides ; `paiement_declare_at` = l'instant du
--   paiement ; la validation de l'équipe remplit `paiement_confirme_*`.
-- - `declarer_paiement` refuse désormais une campagne payée en crédits :
--   sinon une seconde déclaration écrasait le moyen et faisait payer
--   deux fois.
-- - Rendu à la suppression : trigger BEFORE DELETE sur `campagnes`, car
--   le site ET l'app installée suppriment des produits (cascade vers la
--   campagne). La trace (`consommations_credits`) part avec la campagne.
-- - `corriger_credits` vise une boutique, en ligne ou non (l'équipe doit
--   pouvoir retirer des crédits à une boutique suspendue) ; ±10 000 au
--   plus par geste. Le journal la cible par son `merchant_id`
--   (`cible_type` = 'boutique').
-- - `achats_credits.creee_par_equipe` existe pour garder les colonnes
--   d'`abonnements` ; aucune fonction ne l'écrit aujourd'hui (l'équipe
--   offre par `corriger_credits`). Elle seule permettrait un nombre de
--   crédits hors des packs.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE (vérifiée dans `filloo-mobile`,
-- 2026-11-07) : elle ne lit ni `campagnes`, ni `abonnements`, ni
-- `tarifs_*`, ni `journal_equipe`. Elle SUPPRIME des produits : la
-- suppression cascade vers les campagnes, et le nouveau trigger ne fait
-- qu'ajouter des crédits ; il ne lève jamais. Uniquement des ajouts (une
-- colonne avec défaut, trois tables, des fonctions, deux triggers) et des
-- élargissements de contraintes.


-- ---------------------------------------------------------------------
-- 1. Les crédits inclus dans une formule
-- ---------------------------------------------------------------------
alter table public.tarifs_abonnement
  add column credits_inclus int not null default 0 check (credits_inclus >= 0);

comment on column public.tarifs_abonnement.credits_inclus is
  'Crédits de publicité apportés par chaque période active (0060), perdus à sa fin. Écrit SEULEMENT par fixer_credits_inclus.';

-- Décision du porteur du projet du 2026-11-07.
update public.tarifs_abonnement set credits_inclus = 10 where formule = 'business';


-- ---------------------------------------------------------------------
-- 2. Les achats de crédits (comme `abonnements`, 0059)
-- ---------------------------------------------------------------------
create table public.achats_credits (
  id                    uuid primary key default gen_random_uuid(),
  merchant_id           uuid not null references public.merchants(id) on delete cascade,
  credits               int  not null check (credits > 0),
  statut                text not null default 'a_payer'
                        check (statut in ('a_payer', 'en_attente', 'active', 'refusee', 'annulee')),
  prix_gnf              int  not null check (prix_gnf >= 0),
  paiement_moyen        text check (paiement_moyen is null
                          or paiement_moyen in ('orange_money', 'mtn_momo', 'especes', 'offert')),
  paiement_reference    text check (paiement_reference is null
                          or char_length(paiement_reference) between 3 and 60),
  paiement_numero       text check (paiement_numero is null or paiement_numero ~ '^[0-9]{8,15}$'),
  paiement_declare_at   timestamptz,
  paiement_confirme_par uuid references public.equipe(auth_user_id) on delete set null,
  paiement_confirme_at  timestamptz,
  rembourse_par         uuid references public.equipe(auth_user_id) on delete set null,
  rembourse_at          timestamptz,
  creee_par_equipe      uuid references public.equipe(auth_user_id) on delete set null,
  -- Motif de refus.
  motif                 text check (motif is null or char_length(motif) between 3 and 500),
  decidee_par           uuid references public.equipe(auth_user_id) on delete set null,
  decidee_at            timestamptz,
  created_at            timestamptz not null default now(),

  constraint achats_credits_un_pack check (creee_par_equipe is not null or credits in (10, 25, 50)),
  constraint achats_credits_mille_gnf_le_credit check (creee_par_equipe is not null or prix_gnf = credits * 1000),
  constraint achats_credits_refus_motive check (statut <> 'refusee' or motif is not null),
  constraint achats_credits_a_payer_a_un_prix check (statut <> 'a_payer' or prix_gnf > 0),
  constraint achats_credits_offert_est_gratuit check (paiement_moyen is distinct from 'offert' or prix_gnf = 0),
  constraint achats_credits_rembourse_seulement_si_payant check (rembourse_at is null or prix_gnf > 0)
);

comment on table public.achats_credits is
  'Achats de crédits de publicité (0060). Écrits SEULEMENT par demander_credits, declarer_paiement_credits, annuler_achat_credits, decider_achat_credits, marquer_achat_credits_rembourse.';

create unique index achats_credits_une_demande_par_boutique
  on public.achats_credits (merchant_id) where statut in ('a_payer', 'en_attente');
create index achats_credits_par_boutique_idx on public.achats_credits (merchant_id, created_at desc);
create index achats_credits_paiement_confirme_idx on public.achats_credits (paiement_confirme_at)
  where paiement_confirme_at is not null;
create index achats_credits_rembourse_idx on public.achats_credits (rembourse_at)
  where rembourse_at is not null;

alter table public.achats_credits enable row level security;
revoke all on public.achats_credits from anon;
revoke insert, update, delete, truncate, references, trigger on public.achats_credits from authenticated;

create policy "achats_credits: la boutique lit les siens, l'equipe tout"
  on public.achats_credits for select
  to authenticated
  using (
    merchant_id = (select public.my_merchant_id())
    or (select public.je_suis_de_l_equipe())
  );


-- ---------------------------------------------------------------------
-- 3. Les lots et les consommations
-- ---------------------------------------------------------------------
create table public.lots_credits (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null references public.merchants(id) on delete cascade,
  origine          text not null check (origine in ('achat', 'abonnement', 'equipe')),
  credits_initiaux int  not null check (credits_initiaux > 0),
  credits_restants int  not null check (credits_restants >= 0),
  disponible_at    timestamptz not null,
  expire_at        timestamptz not null,
  achat_id         uuid references public.achats_credits(id) on delete cascade,
  abonnement_id    uuid references public.abonnements(id) on delete cascade,
  cree_par         uuid references public.equipe(auth_user_id) on delete set null,
  motif            text check (motif is null or char_length(motif) between 3 and 500),
  created_at       timestamptz not null default now(),

  constraint lots_credits_restants_au_plus_initiaux check (credits_restants <= credits_initiaux),
  constraint lots_credits_periode check (expire_at >= disponible_at),
  constraint lots_credits_origine_achat check ((origine = 'achat') = (achat_id is not null)),
  constraint lots_credits_origine_abonnement check ((origine = 'abonnement') = (abonnement_id is not null)),
  constraint lots_credits_equipe_motivee check (origine <> 'equipe' or motif is not null)
);

comment on table public.lots_credits is
  'Crédits de publicité d''une boutique, par lot (0060). Dépensables si disponible_at <= now() < expire_at. Écrits SEULEMENT par les fonctions de 0060 et le trigger abonnements_donnent_leurs_credits.';

-- Un achat, une période : un lot au plus.
create unique index lots_credits_un_par_achat on public.lots_credits (achat_id) where achat_id is not null;
create unique index lots_credits_un_par_abonnement on public.lots_credits (abonnement_id) where abonnement_id is not null;
create index lots_credits_par_boutique_idx on public.lots_credits (merchant_id, expire_at);

alter table public.lots_credits enable row level security;
revoke all on public.lots_credits from anon;
revoke insert, update, delete, truncate, references, trigger on public.lots_credits from authenticated;

create policy "lots_credits: la boutique lit les siens, l'equipe tout"
  on public.lots_credits for select
  to authenticated
  using (
    merchant_id = (select public.my_merchant_id())
    or (select public.je_suis_de_l_equipe())
  );


create table public.consommations_credits (
  id          uuid primary key default gen_random_uuid(),
  lot_id      uuid not null references public.lots_credits(id) on delete cascade,
  campagne_id uuid not null references public.campagnes(id) on delete cascade,
  credits     int  not null check (credits > 0),
  created_at  timestamptz not null default now(),
  rendu_at    timestamptz
);

comment on table public.consommations_credits is
  'Crédits pris dans un lot pour payer une campagne (0060) ; rendu_at = revenus au lot (refus, annulation avant le début).';

create index consommations_credits_par_campagne_idx on public.consommations_credits (campagne_id);
create index consommations_credits_par_lot_idx on public.consommations_credits (lot_id);

alter table public.consommations_credits enable row level security;
revoke all on public.consommations_credits from anon;
revoke insert, update, delete, truncate, references, trigger on public.consommations_credits from authenticated;

create policy "consommations: la boutique lit les siennes, l'equipe tout"
  on public.consommations_credits for select
  to authenticated
  using (
    lot_id in (select l.id from public.lots_credits l where l.merchant_id = (select public.my_merchant_id()))
    or (select public.je_suis_de_l_equipe())
  );


-- ---------------------------------------------------------------------
-- 4. L'historique de l'équipe connaît les crédits
-- ---------------------------------------------------------------------
-- Toutes les valeurs de 0059, plus celles des crédits.
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'fixer_tarif', 'fixer_moyen_paiement', 'creer_campagne', 'rembourser_campagne',
                    'fixer_tarif_abonnement', 'valider_abonnement', 'refuser_abonnement',
                    'creer_abonnement', 'interrompre_abonnement', 'rembourser_abonnement',
                    'fixer_credits_inclus', 'valider_achat_credits', 'refuser_achat_credits',
                    'rembourser_achat_credits', 'corriger_credits'));

alter table public.journal_equipe drop constraint journal_equipe_cible_type_check;
alter table public.journal_equipe add constraint journal_equipe_cible_type_check
  check (cible_type in ('profil', 'produit', 'signalement', 'campagne', 'tarif', 'moyen_paiement',
                        'tarif_abonnement', 'abonnement',
                        'achat_credits', 'boutique'));


-- ---------------------------------------------------------------------
-- 5. L'équipe règle les crédits inclus
-- ---------------------------------------------------------------------
create or replace function public.fixer_credits_inclus(p_formule text, p_credits int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien int;
  v_id     uuid;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_formule is null or p_formule not in ('pro', 'business') then
    raise exception 'Formule inconnue : Pro ou Business.';
  end if;
  if p_credits is null or p_credits not between 0 and 1000 then
    raise exception 'De 0 à 1 000 crédits par mois.';
  end if;

  select t.credits_inclus, t.id into v_ancien, v_id from public.tarifs_abonnement t
   where t.formule = p_formule for update;
  if v_id is null then
    raise exception 'Cette formule n''a pas encore de prix.';
  end if;

  update public.tarifs_abonnement
     set credits_inclus = p_credits, modifie_par = (select auth.uid()), modifie_at = now()
   where id = v_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'fixer_credits_inclus', 'tarif_abonnement', v_id,
         p_formule || ' : ' || v_ancien || ' → ' || p_credits || ' crédits par mois'
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.fixer_credits_inclus(text, int) from public, anon;
grant execute on function public.fixer_credits_inclus(text, int) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Le solde, la prise, le rendu (internes)
-- ---------------------------------------------------------------------
create or replace function public.solde_credits(p_merchant uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.credits_restants), 0)::int
    from public.lots_credits l
   where l.merchant_id = p_merchant
     and l.disponible_at <= now() and now() < l.expire_at;
$$;

revoke execute on function public.solde_credits(uuid) from public, anon, authenticated;


-- Prend `p_credits` dans les lots disponibles, l'expiration la plus proche
-- d'abord ; note la prise si `p_campagne`. L'appelant a verrouillé la
-- boutique et vérifié le solde ; un solde trop court lève quand même.
create or replace function public.prendre_credits(p_merchant uuid, p_credits int, p_campagne uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reste int := p_credits;
  v_lot   record;
  v_pris  int;
begin
  for v_lot in
    select l.id, l.credits_restants
      from public.lots_credits l
     where l.merchant_id = p_merchant
       and l.credits_restants > 0
       and l.disponible_at <= now() and now() < l.expire_at
     order by l.expire_at, l.created_at, l.id
       for update
  loop
    exit when v_reste = 0;
    v_pris := least(v_reste, v_lot.credits_restants);
    update public.lots_credits set credits_restants = credits_restants - v_pris where id = v_lot.id;
    if p_campagne is not null then
      insert into public.consommations_credits (lot_id, campagne_id, credits)
      values (v_lot.id, p_campagne, v_pris);
    end if;
    v_reste := v_reste - v_pris;
  end loop;

  if v_reste > 0 then
    raise exception 'Crédits insuffisants.';
  end if;
end;
$$;

revoke execute on function public.prendre_credits(uuid, int, uuid) from public, anon, authenticated;


-- Rend à leurs lots les crédits d'une campagne pas encore rendus. Sans
-- effet si elle n'a rien consommé.
create or replace function public.rendre_credits(p_campagne uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lots_credits l
     set credits_restants = l.credits_restants + s.n
    from (select c.lot_id, sum(c.credits)::int as n
            from public.consommations_credits c
           where c.campagne_id = p_campagne and c.rendu_at is null
           group by c.lot_id) s
   where l.id = s.lot_id;

  update public.consommations_credits
     set rendu_at = now()
   where campagne_id = p_campagne and rendu_at is null;
end;
$$;

revoke execute on function public.rendre_credits(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. La boutique achète : demande, déclare son paiement, annule
-- ---------------------------------------------------------------------
create or replace function public.demander_credits(p_credits int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant uuid;
  v_id       uuid;
begin
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

  if p_credits is null or p_credits not in (10, 25, 50) then
    raise exception 'Choisissez un pack de 10, 25 ou 50 crédits.';
  end if;

  if exists (select 1 from public.achats_credits a
              where a.merchant_id = v_merchant and a.statut in ('a_payer', 'en_attente')) then
    raise exception 'Une demande de crédits est déjà en cours : payez-la ou annulez-la d''abord.';
  end if;

  insert into public.achats_credits (merchant_id, credits, prix_gnf, statut)
  values (v_merchant, p_credits, p_credits * 1000, 'a_payer')
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.demander_credits(int) from public, anon;
grant execute on function public.demander_credits(int) to authenticated;


create or replace function public.declarer_paiement_credits(
  p_id uuid, p_moyen text, p_reference text, p_numero text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant  uuid;
  v_a         public.achats_credits%rowtype;
  v_reference text := btrim(coalesce(p_reference, ''));
  v_numero    text := regexp_replace(coalesce(p_numero, ''), '[[:space:].+-]', '', 'g');
begin
  select m.id into v_merchant
    from public.merchants m
    join public.profiles p on p.id = m.profile_id
   where p.auth_user_id = (select auth.uid())
     and p.role = 'merchant'
     and m.status = 'approved'
     and not p.is_deleted
     and not p.is_suspended;
  if v_merchant is null then
    raise exception 'Réservé aux boutiques en ligne.';
  end if;

  select * into v_a from public.achats_credits a
   where a.id = p_id and a.merchant_id = v_merchant
     for update;
  if not found then
    raise exception 'Achat introuvable.';
  end if;

  if p_moyen is null or p_moyen not in ('orange_money', 'mtn_momo') then
    raise exception 'Moyen de paiement : Orange Money ou MTN MoMo.';
  end if;
  if not exists (select 1 from public.moyens_paiement mp where mp.moyen = p_moyen and mp.actif) then
    raise exception 'Ce moyen de paiement n''est pas ouvert.';
  end if;
  if char_length(v_reference) not between 3 and 60 then
    raise exception 'La référence fait de 3 à 60 caractères.';
  end if;
  if v_numero !~ '^[0-9]{8,15}$' then
    raise exception 'Le numéro fait de 8 à 15 chiffres.';
  end if;

  if not (v_a.statut = 'a_payer'
          or (v_a.statut = 'en_attente' and v_a.paiement_declare_at is not null)) then
    raise exception 'Cet achat n''attend pas de paiement.';
  end if;

  update public.achats_credits
     set statut = 'en_attente',
         paiement_moyen = p_moyen,
         paiement_reference = v_reference,
         paiement_numero = v_numero,
         paiement_declare_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.declarer_paiement_credits(uuid, text, text, text) from public, anon;
grant execute on function public.declarer_paiement_credits(uuid, text, text, text) to authenticated;


-- Le commerçant suspendu peut encore annuler sa demande.
create or replace function public.annuler_achat_credits(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.achats_credits%rowtype;
begin
  select * into v_a from public.achats_credits a
   where a.id = p_id and a.merchant_id = public.my_merchant_id()
     for update;
  if not found then
    raise exception 'Achat introuvable.';
  end if;
  if v_a.statut not in ('a_payer', 'en_attente') then
    raise exception 'Cet achat ne peut plus être annulé.';
  end if;

  update public.achats_credits set statut = 'annulee' where id = p_id;
end;
$$;

revoke execute on function public.annuler_achat_credits(uuid) from public, anon;
grant execute on function public.annuler_achat_credits(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 8. L'équipe décide (et vérifie le paiement), note un remboursement
-- ---------------------------------------------------------------------
create or replace function public.decider_achat_credits(p_id uuid, p_accepter boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a     public.achats_credits%rowtype;
  v_motif text := btrim(coalesce(p_motif, ''));
  v_paye  boolean;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_accepter is null then
    raise exception 'Acceptez ou refusez.';
  end if;

  select * into v_a from public.achats_credits a where a.id = p_id for update;
  if not found then
    raise exception 'Achat introuvable.';
  end if;
  if v_a.statut not in ('a_payer', 'en_attente') then
    raise exception 'Cet achat a déjà été décidé.';
  end if;

  v_paye := v_a.prix_gnf > 0;

  if p_accepter then
    if v_a.statut = 'a_payer' or (v_paye and v_a.paiement_declare_at is null) then
      raise exception 'Le paiement n''est pas encore déclaré.';
    end if;
    if not public.merchant_is_public(v_a.merchant_id) then
      raise exception 'Cette boutique n''est plus en ligne.';
    end if;

    update public.achats_credits
       set statut = 'active',
           decidee_par = (select auth.uid()),
           decidee_at = now(),
           paiement_confirme_par = case when v_paye then (select auth.uid()) end,
           paiement_confirme_at  = case when v_paye then now() end
     where id = p_id;

    insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants,
                                     disponible_at, expire_at, achat_id)
    values (v_a.merchant_id, 'achat', v_a.credits, v_a.credits, now(), now() + interval '12 months', p_id);

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'valider_achat_credits', 'achat_credits', p_id,
           left('Paiement vérifié : ' || v_a.credits || ' crédits, ' || v_a.prix_gnf || ' GNF, '
                || coalesce(v_a.paiement_moyen, '?') || coalesce(' ' || v_a.paiement_reference, ''), 500)
      from public.equipe e where e.auth_user_id = (select auth.uid());
  else
    if char_length(v_motif) not between 3 and 500 then
      raise exception 'Le motif fait de 3 à 500 caractères.';
    end if;

    update public.achats_credits
       set statut = 'refusee',
           motif = v_motif,
           decidee_par = (select auth.uid()),
           decidee_at = now()
     where id = p_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'refuser_achat_credits', 'achat_credits', p_id, v_motif
      from public.equipe e where e.auth_user_id = (select auth.uid());
  end if;
end;
$$;

revoke execute on function public.decider_achat_credits(uuid, boolean, text) from public, anon;
grant execute on function public.decider_achat_credits(uuid, boolean, text) to authenticated;


create or replace function public.marquer_achat_credits_rembourse(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.achats_credits%rowtype;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  select * into v_a from public.achats_credits a where a.id = p_id for update;
  if not found then
    raise exception 'Achat introuvable.';
  end if;
  if v_a.rembourse_at is not null then
    raise exception 'Cet achat est déjà remboursé.';
  end if;
  if v_a.prix_gnf = 0
     or (v_a.paiement_declare_at is null and v_a.paiement_confirme_at is null) then
    raise exception 'Rien n''a été payé pour cet achat.';
  end if;
  if v_a.statut not in ('refusee', 'annulee') then
    raise exception 'Seul un achat refusé ou annulé se rembourse.';
  end if;

  update public.achats_credits
     set rembourse_par = (select auth.uid()), rembourse_at = now()
   where id = p_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'rembourser_achat_credits', 'achat_credits', p_id,
         left(v_a.prix_gnf || ' GNF, ' || coalesce(v_a.paiement_moyen, '?')
              || coalesce(' ' || v_a.paiement_reference, ''), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.marquer_achat_credits_rembourse(uuid) from public, anon;
grant execute on function public.marquer_achat_credits_rembourse(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 9. Un abonnement actif apporte ses crédits ; interrompu, ils expirent
-- ---------------------------------------------------------------------
-- Trigger plutôt qu'un appel dans `decider_abonnement` et
-- `creer_abonnement_equipe` : tout chemin qui rend un abonnement actif
-- (présent ou futur) est couvert, sans réécrire les fonctions de 0059.
create or replace function public.abonnement_donne_ses_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credits int;
begin
  if new.statut = 'active' and (tg_op = 'INSERT' or old.statut <> 'active') then
    select t.credits_inclus into v_credits from public.tarifs_abonnement t where t.formule = new.formule;
    if coalesce(v_credits, 0) > 0 then
      insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants,
                                       disponible_at, expire_at, abonnement_id)
      values (new.merchant_id, 'abonnement', v_credits, v_credits, new.debut_at, new.fin_at, new.id)
      on conflict (abonnement_id) where abonnement_id is not null do nothing;
    end if;
  elsif tg_op = 'UPDATE' and old.statut = 'active' and new.statut <> 'active' then
    update public.lots_credits
       set expire_at = least(expire_at, now()),
           disponible_at = least(disponible_at, now())
     where abonnement_id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function public.abonnement_donne_ses_credits() from public, anon, authenticated;

create trigger abonnements_donnent_leurs_credits
  after insert or update of statut on public.abonnements
  for each row execute function public.abonnement_donne_ses_credits();


-- ---------------------------------------------------------------------
-- 10. Payer une campagne en crédits
-- ---------------------------------------------------------------------
-- Nom par défaut de la contrainte de colonne de 0058 (constaté sur la
-- base de test : 0058 n'est pas en production).
alter table public.campagnes drop constraint campagnes_paiement_moyen_check;
alter table public.campagnes add constraint campagnes_paiement_moyen_check
  check (paiement_moyen is null
         or paiement_moyen in ('orange_money', 'mtn_momo', 'especes', 'offert', 'credits'));

comment on table public.campagnes is
  'Publicité (0047, prix et paiement 0058, crédits 0060). Écrite SEULEMENT par demander_campagne, declarer_paiement, payer_campagne_en_credits, annuler_campagne, decider_campagne, interrompre_campagne, creer_campagne_equipe, marquer_rembourse. « Terminée » = active et fin_at passée.';


create or replace function public.payer_campagne_en_credits(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant uuid;
  v_c        public.campagnes%rowtype;
  v_cout     int;
  v_solde    int;
begin
  -- Boutique en ligne, verrouillée : deux paiements simultanés se suivent.
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

  select * into v_c from public.campagnes c
   where c.id = p_id and c.merchant_id = v_merchant
     for update;
  if not found then
    raise exception 'Campagne introuvable.';
  end if;
  if v_c.statut <> 'a_payer' then
    raise exception 'Cette campagne n''attend pas de paiement.';
  end if;
  if v_c.prix_gnf is null or v_c.prix_gnf <= 0 or v_c.prix_gnf % 1000 <> 0 then
    raise exception 'Ce prix ne se paie pas en crédits (1 crédit = 1 000 GNF).';
  end if;

  v_cout  := v_c.prix_gnf / 1000;
  v_solde := public.solde_credits(v_merchant);
  if v_solde < v_cout then
    raise exception 'Crédits insuffisants : il vous en faut %, vous en avez %.', v_cout, v_solde;
  end if;

  perform public.prendre_credits(v_merchant, v_cout, p_id);

  update public.campagnes
     set statut = 'en_attente',
         paiement_moyen = 'credits',
         paiement_reference = null,
         paiement_numero = null,
         paiement_declare_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.payer_campagne_en_credits(uuid) from public, anon;
grant execute on function public.payer_campagne_en_credits(uuid) to authenticated;


-- Même corps que 0058, plus le refus d'une campagne déjà payée en crédits.
create or replace function public.declarer_paiement(
  p_id uuid, p_moyen text, p_reference text, p_numero text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant  uuid;
  v_c         public.campagnes%rowtype;
  v_reference text := btrim(coalesce(p_reference, ''));
  v_numero    text := regexp_replace(coalesce(p_numero, ''), '[[:space:].+-]', '', 'g');
begin
  select m.id into v_merchant
    from public.merchants m
    join public.profiles p on p.id = m.profile_id
   where p.auth_user_id = (select auth.uid())
     and p.role = 'merchant'
     and m.status = 'approved'
     and not p.is_deleted
     and not p.is_suspended;
  if v_merchant is null then
    raise exception 'Réservé aux boutiques en ligne.';
  end if;

  select * into v_c from public.campagnes c
   where c.id = p_id and c.merchant_id = v_merchant
     for update;
  if not found then
    raise exception 'Campagne introuvable.';
  end if;
  if v_c.paiement_moyen = 'credits' then
    raise exception 'Cette campagne est déjà payée en crédits.';
  end if;

  if p_moyen is null or p_moyen not in ('orange_money', 'mtn_momo') then
    raise exception 'Moyen de paiement : Orange Money ou MTN MoMo.';
  end if;
  if not exists (select 1 from public.moyens_paiement mp where mp.moyen = p_moyen and mp.actif) then
    raise exception 'Ce moyen de paiement n''est pas ouvert.';
  end if;
  if char_length(v_reference) not between 3 and 60 then
    raise exception 'La référence fait de 3 à 60 caractères.';
  end if;
  if v_numero !~ '^[0-9]{8,15}$' then
    raise exception 'Le numéro fait de 8 à 15 chiffres.';
  end if;

  if not (v_c.statut = 'a_payer'
          or (v_c.statut = 'en_attente' and v_c.paiement_declare_at is not null)) then
    raise exception 'Cette campagne n''attend pas de paiement.';
  end if;

  update public.campagnes
     set statut = 'en_attente',
         paiement_moyen = p_moyen,
         paiement_reference = v_reference,
         paiement_numero = v_numero,
         paiement_declare_at = now()
   where id = p_id;
end;
$$;


-- Même corps que 0058, plus le rendu des crédits avant le début.
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

  if v_c.statut in ('a_payer', 'en_attente') then
    update public.campagnes set statut = 'annulee' where id = p_id;
    perform public.rendre_credits(p_id);
  elsif v_c.statut = 'active' and v_c.fin_at > now() then
    update public.campagnes set statut = 'annulee', fin_at = now() where id = p_id;
  else
    raise exception 'Cette campagne ne peut plus être annulée.';
  end if;
end;
$$;


-- Même corps que 0058 ; une campagne payée en crédits est « déclarée »
-- par son paiement, se valide comme les autres (paiement confirmé), et
-- rend ses crédits si elle est refusée.
create or replace function public.decider_campagne(p_id uuid, p_accepter boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c       public.campagnes%rowtype;
  v_motif   text := btrim(coalesce(p_motif, ''));
  v_paye    boolean;
  v_credits boolean;
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
  if v_c.statut not in ('a_payer', 'en_attente') then
    raise exception 'Cette campagne a déjà été décidée.';
  end if;

  v_paye    := coalesce(v_c.prix_gnf, 0) > 0;
  v_credits := v_c.paiement_moyen is not distinct from 'credits';

  if p_accepter then
    if v_c.statut = 'a_payer' or (v_paye and v_c.paiement_declare_at is null) then
      raise exception 'Le paiement n''est pas encore déclaré.';
    end if;
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
           decidee_at = now(),
           paiement_confirme_par = case when v_paye then (select auth.uid()) end,
           paiement_confirme_at  = case when v_paye then now() end
     where id = p_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'valider_campagne', 'campagne', p_id,
           case when v_credits then 'Payée en crédits : ' || (v_c.prix_gnf / 1000) || ' crédits'
                when v_paye then left('Paiement vérifié : ' || v_c.prix_gnf || ' GNF, '
                                      || v_c.paiement_moyen || ' ' || v_c.paiement_reference, 500) end
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

    perform public.rendre_credits(p_id);

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'refuser_campagne', 'campagne', p_id, v_motif
      from public.equipe e where e.auth_user_id = (select auth.uid());
  end if;
end;
$$;


-- Même corps que 0058, plus le refus d'une campagne payée en crédits.
create or replace function public.marquer_rembourse(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.campagnes%rowtype;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  select * into v_c from public.campagnes c where c.id = p_id for update;
  if not found then
    raise exception 'Campagne introuvable.';
  end if;
  if v_c.paiement_moyen = 'credits' then
    raise exception 'Payée en crédits : rien à rembourser en argent (les crédits sont rendus d''eux-mêmes).';
  end if;
  if v_c.rembourse_at is not null then
    raise exception 'Cette campagne est déjà remboursée.';
  end if;
  if coalesce(v_c.prix_gnf, 0) = 0
     or (v_c.paiement_declare_at is null and v_c.paiement_confirme_at is null) then
    raise exception 'Rien n''a été payé pour cette campagne.';
  end if;
  if v_c.statut not in ('refusee', 'annulee', 'interrompue') then
    raise exception 'Seule une campagne refusée, annulée ou interrompue se rembourse.';
  end if;

  update public.campagnes
     set rembourse_par = (select auth.uid()), rembourse_at = now()
   where id = p_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'rembourser_campagne', 'campagne', p_id,
         left(v_c.prix_gnf || ' GNF, ' || coalesce(v_c.paiement_moyen, '?')
              || coalesce(' ' || v_c.paiement_reference, ''), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;


-- Même corps que 0058 ; une campagne payée en crédits n'est pas de
-- l'argent encaissé (il l'a été à l'achat des crédits).
create or replace function public.revenus_publicite()
returns table (mois date, encaisse_gnf bigint, rembourse_gnf bigint, campagnes bigint)
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
  with mouvements as (
    select date_trunc('month', c.paiement_confirme_at at time zone 'Africa/Conakry')::date as m,
           c.prix_gnf::bigint as encaisse, 0::bigint as rembourse, 1::bigint as n
      from public.campagnes c
     where c.paiement_confirme_at is not null and c.prix_gnf > 0
       and c.paiement_moyen is distinct from 'credits'
    union all
    select date_trunc('month', c.rembourse_at at time zone 'Africa/Conakry')::date,
           0::bigint, c.prix_gnf::bigint, 0::bigint
      from public.campagnes c
     where c.rembourse_at is not null and c.prix_gnf > 0
       and c.paiement_moyen is distinct from 'credits'
  )
  select mv.m, sum(mv.encaisse)::bigint, sum(mv.rembourse)::bigint, sum(mv.n)::bigint
    from mouvements mv
   group by mv.m
   order by mv.m desc;
end;
$$;


-- Une campagne supprimée avant son début (produit supprimé) rend ses
-- crédits. Boutique supprimée : rien à rendre (ses lots partent avec
-- elle), et écrire dans un lot dont la boutique vient de disparaître
-- ferait échouer la suppression (clé étrangère, constaté en test).
-- L'app installée supprime des produits : ce trigger ne doit pas lever.
create or replace function public.campagne_supprimee_rend_ses_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.statut in ('a_payer', 'en_attente')
     and exists (select 1 from public.merchants m where m.id = old.merchant_id) then
    perform public.rendre_credits(old.id);
  end if;
  return old;
end;
$$;

revoke execute on function public.campagne_supprimee_rend_ses_credits() from public, anon, authenticated;

create trigger campagnes_rendent_leurs_credits_a_la_suppression
  before delete on public.campagnes
  for each row execute function public.campagne_supprimee_rend_ses_credits();


-- ---------------------------------------------------------------------
-- 11. L'équipe corrige un solde
-- ---------------------------------------------------------------------
create or replace function public.corriger_credits(p_merchant uuid, p_credits int, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant uuid;
  v_motif    text := btrim(coalesce(p_motif, ''));
  v_solde    int;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_credits is null or p_credits = 0 or p_credits not between -10000 and 10000 then
    raise exception 'Indiquez un nombre de crédits (de -10 000 à 10 000), négatif pour en retirer.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select m.id into v_merchant from public.merchants m where m.id = p_merchant for update;
  if v_merchant is null then
    raise exception 'Boutique introuvable.';
  end if;

  if p_credits > 0 then
    insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants,
                                     disponible_at, expire_at, cree_par, motif)
    values (v_merchant, 'equipe', p_credits, p_credits, now(), now() + interval '12 months',
            (select auth.uid()), v_motif);
  else
    v_solde := public.solde_credits(v_merchant);
    if v_solde < -p_credits then
      raise exception 'Cette boutique n''a que % crédits disponibles.', v_solde;
    end if;
    perform public.prendre_credits(v_merchant, -p_credits, null);
  end if;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'corriger_credits', 'boutique', v_merchant,
         left(case when p_credits > 0 then '+' else '' end || p_credits || ' crédits : ' || v_motif, 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.corriger_credits(uuid, int, text) from public, anon;
grant execute on function public.corriger_credits(uuid, int, text) to authenticated;


-- ---------------------------------------------------------------------
-- 12. Lire : le solde de la boutique, les soldes, la file, les revenus
-- ---------------------------------------------------------------------
-- La boutique de l'appelant ; aucune ligne s'il n'a pas de boutique.
create or replace function public.mes_credits()
returns table (disponibles int, expirent_sous_30_jours int, prochaine_expiration timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant uuid := public.my_merchant_id();
begin
  if v_merchant is null then
    return;
  end if;

  return query
  select coalesce(sum(l.credits_restants), 0)::int,
         coalesce(sum(l.credits_restants) filter (where l.expire_at <= now() + interval '30 days'), 0)::int,
         min(l.expire_at)
    from public.lots_credits l
   where l.merchant_id = v_merchant
     and l.credits_restants > 0
     and l.disponible_at <= now() and now() < l.expire_at;
end;
$$;

revoke execute on function public.mes_credits() from public, anon;
grant execute on function public.mes_credits() to authenticated;


-- Boutiques qui ont un solde ou au moins un achat ; 200 au plus.
create or replace function public.credits_equipe()
returns table (merchant_id uuid, shop_name text, disponibles int)
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
  select m.id, m.shop_name, public.solde_credits(m.id)
    from public.merchants m
   where exists (select 1 from public.achats_credits a where a.merchant_id = m.id)
      or public.solde_credits(m.id) > 0
   order by 3 desc, m.shop_name, m.id
   limit 200;
end;
$$;

revoke execute on function public.credits_equipe() from public, anon;
grant execute on function public.credits_equipe() to authenticated;


create or replace function public.achats_credits_equipe()
returns table (
  id                   uuid,
  credits              int,
  statut               text,
  prix_gnf             int,
  motif                text,
  created_at           timestamptz,
  merchant_id          uuid,
  shop_name            text,
  paiement_moyen       text,
  paiement_reference   text,
  paiement_numero      text,
  paiement_declare_at  timestamptz,
  paiement_confirme_at timestamptz,
  rembourse_at         timestamptz,
  creee_par_equipe     uuid
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
  select a.id, a.credits, a.statut, a.prix_gnf, a.motif, a.created_at,
         m.id, m.shop_name,
         a.paiement_moyen, a.paiement_reference, a.paiement_numero,
         a.paiement_declare_at, a.paiement_confirme_at, a.rembourse_at, a.creee_par_equipe
    from public.achats_credits a
    join public.merchants m on m.id = a.merchant_id
   order by a.created_at desc, a.id
   limit 200;
end;
$$;

revoke execute on function public.achats_credits_equipe() from public, anon;
grant execute on function public.achats_credits_equipe() to authenticated;


-- Comme `revenus_abonnements` (0059) : encaissé au mois de la
-- VÉRIFICATION, remboursé au mois du REMBOURSEMENT, heure de Conakry.
create or replace function public.revenus_credits()
returns table (mois date, encaisse_gnf bigint, rembourse_gnf bigint, achats bigint)
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
  with mouvements as (
    select date_trunc('month', a.paiement_confirme_at at time zone 'Africa/Conakry')::date as m,
           a.prix_gnf::bigint as encaisse, 0::bigint as rembourse, 1::bigint as n
      from public.achats_credits a
     where a.paiement_confirme_at is not null and a.prix_gnf > 0
    union all
    select date_trunc('month', a.rembourse_at at time zone 'Africa/Conakry')::date,
           0::bigint, a.prix_gnf::bigint, 0::bigint
      from public.achats_credits a
     where a.rembourse_at is not null and a.prix_gnf > 0
  )
  select mv.m, sum(mv.encaisse)::bigint, sum(mv.rembourse)::bigint, sum(mv.n)::bigint
    from mouvements mv
   group by mv.m
   order by mv.m desc;
end;
$$;

revoke execute on function public.revenus_credits() from public, anon;
grant execute on function public.revenus_credits() to authenticated;
