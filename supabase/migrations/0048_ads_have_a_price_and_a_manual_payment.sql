-- =====================================================================
-- 0048 : une publicité a un prix, payé à la main et vérifié par l'équipe
-- =====================================================================
-- Étape suivante du document de monétisation (section 7, « validation
-- manuelle ») : le commerçant paie par Orange Money ou MTN MoMo sur le
-- numéro de Filloo, déclare sa référence, et l'équipe vérifie le
-- paiement en validant la campagne. Pas de crédits, pas de paiement
-- automatique. Branche `monetisation` : NE S'APPLIQUE PAS avant que le
-- porteur du projet publie cette branche.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Les prix (`tarifs_publicite`) et les numéros de paiement
--    (`moyens_paiement`) ne s'écrivent que par `fixer_tarif` et
--    `fixer_moyen_paiement`, réservées à l'équipe et inscrites dans
--    `journal_equipe`. Tout le monde lit les prix ; seul un compte
--    connecté lit les numéros.
-- 2. Le prix d'une campagne est FIGÉ à la demande : changer un tarif ne
--    change pas ce qu'un commerçant doit déjà.
-- 3. Une campagne payante naît « a_payer » ; seul son commerçant (boutique
--    en ligne) déclare son paiement, par un moyen ACTIF ; elle passe alors
--    « en_attente ». L'équipe ne peut pas valider une campagne payante
--    dont le paiement n'est pas déclaré ; valider = paiement vérifié
--    (`paiement_confirme_par/at`).
-- 4. L'équipe peut créer une campagne déjà payée (espèces, Orange Money,
--    MTN) ou offerte, directement en cours, sans le plafond de 3.
-- 5. Un remboursement ne se note qu'une fois, sur une campagne payante
--    payée puis refusée, annulée ou interrompue.
-- 6. `revenus_publicite` : encaissé par mois de VÉRIFICATION du paiement,
--    remboursé par mois du REMBOURSEMENT (les deux à l'heure de Conakry,
--    UTC+0). Un mois passé ne change donc jamais après coup : c'est la
--    vue « caisse », pas la vue « par campagne ».
--
-- CHOIX
-- - `tarifs_publicite` et `moyens_paiement` portent chacune une colonne
--   `id uuid` (unique, en plus de la clé demandée) : `journal_equipe.
--   cible_id` est `uuid not null`, et le rendre nullable changerait le
--   type que le site lit. Le motif du journal dit l'ancien et le nouveau.
-- - Les campagnes de 0047 (prix `null`) sont traitées comme gratuites.
--   Production au 2026-11-07 : 0 campagne (constaté), rien à reprendre.
-- - Le numéro de paiement est nettoyé (espaces, points, tirets, « + »)
--   puis doit faire 8 à 15 chiffres ; il est obligatoire à la déclaration
--   (l'équipe en a besoin pour retrouver le paiement).
-- - Une campagne « a_payer » occupe une des trois places : un commerçant
--   l'annule s'il ne paie pas. Rien ne l'expire la nuit.
-- - Un remboursement est TOUJOURS du prix entier : un remboursement
--   partiel (annulation en cours de campagne) n'est pas modélisé.
-- - `produits_sponsorises` et `boutiques_mises_en_avant` (0047) tirent
--   déjà au sort (`order by random()` après le choix d'une campagne par
--   boutique) : les annonceurs tournent quand ils dépassent les places.
--   Non touchées.
--
-- COMPATIBILITÉ : l'app mobile n'appelle aucune fonction de publicité
-- (dépôt absent de la session, non vérifié ici : à confirmer par
-- `relecteur-compat`). Pour le site : `campagnes_equipe` est supprimée et
-- recréée avec des colonnes EN PLUS, à la fin ; les signatures de
-- `demander_campagne`, `annuler_campagne`, `decider_campagne` ne
-- changent pas. Changement de COMPORTEMENT : une fois les tarifs posés,
-- une demande naît « a_payer », que le site de `dev` ne sait pas encore
-- afficher ni payer — ne pas appliquer sans le site de `monetisation`.


-- ---------------------------------------------------------------------
-- 1. Les prix
-- ---------------------------------------------------------------------
create table public.tarifs_publicite (
  type        text not null check (type in ('produit', 'boutique', 'categorie')),
  duree_jours int  not null check (duree_jours in (3, 7, 14, 30)),
  prix_gnf    int  not null check (prix_gnf >= 0),
  id          uuid not null unique default gen_random_uuid(),
  modifie_par uuid references public.equipe(auth_user_id) on delete set null,
  modifie_at  timestamptz,
  primary key (type, duree_jours)
);

comment on table public.tarifs_publicite is
  'Prix d''une campagne (0048), lu par tous. Écrit SEULEMENT par fixer_tarif. `id` sert de cible dans journal_equipe.';

alter table public.tarifs_publicite enable row level security;
revoke all on public.tarifs_publicite from anon, authenticated;
grant select on public.tarifs_publicite to anon, authenticated;

create policy "tarifs_publicite: tout le monde lit les prix"
  on public.tarifs_publicite for select
  to anon, authenticated
  using (true);

-- Hypothèses du document de monétisation, à ajuster par `fixer_tarif`.
insert into public.tarifs_publicite (type, duree_jours, prix_gnf) values
  ('produit',    3,  7000), ('produit',    7, 15000), ('produit',   14, 25000), ('produit',   30, 45000),
  ('categorie',  3,  5000), ('categorie',  7, 10000), ('categorie', 14, 18000), ('categorie', 30, 32000),
  ('boutique',   3, 10000), ('boutique',   7, 20000), ('boutique',  14, 35000), ('boutique',  30, 60000);


-- ---------------------------------------------------------------------
-- 2. Les numéros sur lesquels on paie Filloo
-- ---------------------------------------------------------------------
create table public.moyens_paiement (
  moyen       text primary key check (moyen in ('orange_money', 'mtn_momo')),
  numero      text not null check (numero ~ '^[0-9]{8,15}$'),
  titulaire   text not null check (char_length(titulaire) between 2 and 80),
  actif       boolean not null default false,
  id          uuid not null unique default gen_random_uuid(),
  modifie_par uuid references public.equipe(auth_user_id) on delete set null,
  modifie_at  timestamptz
);

comment on table public.moyens_paiement is
  'Numéros Orange Money / MTN MoMo de Filloo (0048), lus par un compte connecté. Écrit SEULEMENT par fixer_moyen_paiement.';

alter table public.moyens_paiement enable row level security;
revoke all on public.moyens_paiement from anon, authenticated;
grant select on public.moyens_paiement to authenticated;

create policy "moyens_paiement: un compte connecte lit les numeros"
  on public.moyens_paiement for select
  to authenticated
  using (true);


-- ---------------------------------------------------------------------
-- 3. Une campagne a un prix et un paiement
-- ---------------------------------------------------------------------
alter table public.campagnes
  add column prix_gnf              int check (prix_gnf is null or prix_gnf >= 0),
  add column paiement_moyen        text check (paiement_moyen is null
                                    or paiement_moyen in ('orange_money', 'mtn_momo', 'especes', 'offert')),
  add column paiement_reference    text check (paiement_reference is null
                                    or char_length(paiement_reference) between 3 and 60),
  add column paiement_numero       text check (paiement_numero is null or paiement_numero ~ '^[0-9]{8,15}$'),
  add column paiement_declare_at   timestamptz,
  add column paiement_confirme_par uuid references public.equipe(auth_user_id) on delete set null,
  add column paiement_confirme_at  timestamptz,
  add column rembourse_par         uuid references public.equipe(auth_user_id) on delete set null,
  add column rembourse_at          timestamptz,
  add column creee_par_equipe      uuid references public.equipe(auth_user_id) on delete set null;

-- Nom constaté en production le 2026-11-07 (`pg_constraint`).
alter table public.campagnes drop constraint campagnes_statut_check;
alter table public.campagnes add constraint campagnes_statut_check
  check (statut in ('a_payer', 'en_attente', 'active', 'refusee', 'annulee', 'interrompue'));

alter table public.campagnes
  add constraint campagnes_a_payer_a_un_prix
    check (statut <> 'a_payer' or prix_gnf > 0),
  add constraint campagnes_offert_est_gratuit
    check (paiement_moyen is distinct from 'offert' or prix_gnf = 0),
  add constraint campagnes_rembourse_seulement_si_payant
    check (rembourse_at is null or prix_gnf > 0);

comment on table public.campagnes is
  'Publicité (0047, prix et paiement 0048). Écrite SEULEMENT par demander_campagne, declarer_paiement, annuler_campagne, decider_campagne, interrompre_campagne, creer_campagne_equipe, marquer_rembourse. « Terminée » = active et fin_at passée.';

create index campagnes_paiement_confirme_idx on public.campagnes (paiement_confirme_at)
  where paiement_confirme_at is not null;
create index campagnes_rembourse_idx on public.campagnes (rembourse_at)
  where rembourse_at is not null;


-- ---------------------------------------------------------------------
-- 4. L'historique de l'équipe connaît les prix et les paiements
-- ---------------------------------------------------------------------
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'fixer_tarif', 'fixer_moyen_paiement', 'creer_campagne', 'rembourser_campagne'));

alter table public.journal_equipe drop constraint journal_equipe_cible_type_check;
alter table public.journal_equipe add constraint journal_equipe_cible_type_check
  check (cible_type in ('profil', 'produit', 'signalement', 'campagne', 'tarif', 'moyen_paiement'));


-- ---------------------------------------------------------------------
-- 5. L'équipe fixe les prix et les numéros
-- ---------------------------------------------------------------------
create or replace function public.fixer_tarif(p_type text, p_duree int, p_prix int)
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
  if p_type is null or p_type not in ('produit', 'boutique', 'categorie') then
    raise exception 'Type de campagne inconnu.';
  end if;
  if p_duree is null or p_duree not in (3, 7, 14, 30) then
    raise exception 'Durée possible : 3, 7, 14 ou 30 jours.';
  end if;
  if p_prix is null or p_prix not between 0 and 100000000 then
    raise exception 'Le prix va de 0 à 100 000 000 GNF.';
  end if;

  select t.prix_gnf into v_ancien from public.tarifs_publicite t
   where t.type = p_type and t.duree_jours = p_duree for update;

  insert into public.tarifs_publicite as t (type, duree_jours, prix_gnf, modifie_par, modifie_at)
  values (p_type, p_duree, p_prix, (select auth.uid()), now())
  on conflict (type, duree_jours) do update
     set prix_gnf = excluded.prix_gnf, modifie_par = excluded.modifie_par, modifie_at = excluded.modifie_at
  returning t.id into v_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'fixer_tarif', 'tarif', v_id,
         p_type || ' ' || p_duree || ' j : ' || coalesce(v_ancien::text, 'aucun') || ' → ' || p_prix || ' GNF'
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.fixer_tarif(text, int, int) from public, anon;
grant execute on function public.fixer_tarif(text, int, int) to authenticated;


create or replace function public.fixer_moyen_paiement(
  p_moyen text, p_numero text, p_titulaire text, p_actif boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero    text := regexp_replace(coalesce(p_numero, ''), '[[:space:].+-]', '', 'g');
  v_titulaire text := btrim(coalesce(p_titulaire, ''));
  v_id        uuid;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_moyen is null or p_moyen not in ('orange_money', 'mtn_momo') then
    raise exception 'Moyen de paiement : Orange Money ou MTN MoMo.';
  end if;
  if v_numero !~ '^[0-9]{8,15}$' then
    raise exception 'Le numéro fait de 8 à 15 chiffres.';
  end if;
  if char_length(v_titulaire) not between 2 and 80 then
    raise exception 'Le titulaire fait de 2 à 80 caractères.';
  end if;
  if p_actif is null then
    raise exception 'Dites si ce moyen est actif.';
  end if;

  insert into public.moyens_paiement as m (moyen, numero, titulaire, actif, modifie_par, modifie_at)
  values (p_moyen, v_numero, v_titulaire, p_actif, (select auth.uid()), now())
  on conflict (moyen) do update
     set numero = excluded.numero, titulaire = excluded.titulaire, actif = excluded.actif,
         modifie_par = excluded.modifie_par, modifie_at = excluded.modifie_at
  returning m.id into v_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'fixer_moyen_paiement', 'moyen_paiement', v_id,
         left(p_moyen || ' : ' || v_numero || ' (' || v_titulaire || ')'
              || case when p_actif then ', actif' else ', inactif' end, 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.fixer_moyen_paiement(text, text, text, boolean) from public, anon;
grant execute on function public.fixer_moyen_paiement(text, text, text, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Le commerçant demande (prix figé), déclare son paiement, annule
-- ---------------------------------------------------------------------
-- Même signature que 0047. Seuls changent : le tarif lu et figé, le
-- statut de départ, et `a_payer` compté dans le plafond et le doublon.
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
  v_prix     int;
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

  select t.prix_gnf into v_prix from public.tarifs_publicite t
   where t.type = p_type and t.duree_jours = p_duree;
  if v_prix is null then
    raise exception 'Cette offre n''a pas encore de prix.';
  end if;

  if (select count(*) from public.campagnes c
       where c.merchant_id = v_merchant
         and (c.statut in ('a_payer', 'en_attente') or (c.statut = 'active' and c.fin_at > now()))) >= 3 then
    raise exception 'Trois campagnes au plus en même temps.';
  end if;

  if exists (select 1 from public.campagnes c
              where c.merchant_id = v_merchant
                and c.type = p_type
                and c.product_id is not distinct from p_product
                and c.category_id is not distinct from p_category
                and (c.statut in ('a_payer', 'en_attente') or (c.statut = 'active' and c.fin_at > now()))) then
    raise exception 'Cette campagne est déjà en attente ou en cours.';
  end if;

  insert into public.campagnes (merchant_id, type, product_id, category_id, duree_jours, prix_gnf, statut)
  values (v_merchant, p_type, p_product, p_category, p_duree, v_prix,
          case when v_prix > 0 then 'a_payer' else 'en_attente' end)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.demander_campagne(text, uuid, int, int) from public, anon;
grant execute on function public.demander_campagne(text, uuid, int, int) to authenticated;


-- Le commerçant suspendu ne déclare pas (écrire = boutique en ligne) ; il
-- peut toujours annuler. Une campagne d'autrui est « introuvable ».
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

revoke execute on function public.declarer_paiement(uuid, text, text, text) from public, anon;
grant execute on function public.declarer_paiement(uuid, text, text, text) to authenticated;


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
  elsif v_c.statut = 'active' and v_c.fin_at > now() then
    update public.campagnes set statut = 'annulee', fin_at = now() where id = p_id;
  else
    raise exception 'Cette campagne ne peut plus être annulée.';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. L'équipe décide (et vérifie le paiement)
-- ---------------------------------------------------------------------
create or replace function public.decider_campagne(p_id uuid, p_accepter boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c     public.campagnes%rowtype;
  v_motif text := btrim(coalesce(p_motif, ''));
  v_paye  boolean;
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

  v_paye := coalesce(v_c.prix_gnf, 0) > 0;

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
           case when v_paye then left('Paiement vérifié : ' || v_c.prix_gnf || ' GNF, '
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

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'refuser_campagne', 'campagne', p_id, v_motif
      from public.equipe e where e.auth_user_id = (select auth.uid());
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. L'équipe crée une campagne déjà payée, ou offerte
-- ---------------------------------------------------------------------
create or replace function public.creer_campagne_equipe(
  p_merchant  uuid,
  p_type      text,
  p_product   uuid default null,
  p_category  int  default null,
  p_duree     int  default null,
  p_moyen     text default null,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant  uuid;
  v_prix      int;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_id        uuid;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  -- Boutique en ligne, verrouillée (doublon).
  select m.id into v_merchant
    from public.merchants m
    join public.profiles p on p.id = m.profile_id
   where m.id = p_merchant
     and m.status = 'approved'
     and not p.is_deleted
     and not p.is_suspended
     for update of m;
  if v_merchant is null then
    raise exception 'Cette boutique n''est pas en ligne.';
  end if;

  if p_type is null or p_type not in ('produit', 'boutique', 'categorie') then
    raise exception 'Type de campagne inconnu.';
  end if;
  if p_duree is null or p_duree not in (3, 7, 14, 30) then
    raise exception 'Durée possible : 3, 7, 14 ou 30 jours.';
  end if;
  if p_moyen is null or p_moyen not in ('especes', 'orange_money', 'mtn_momo', 'offert') then
    raise exception 'Moyen : espèces, Orange Money, MTN MoMo ou offert.';
  end if;
  if v_reference is not null and char_length(v_reference) not between 3 and 60 then
    raise exception 'La référence fait de 3 à 60 caractères.';
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
      raise exception 'Ce produit n''est pas publié dans cette boutique.';
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

  if p_moyen = 'offert' then
    v_prix := 0;
  else
    select t.prix_gnf into v_prix from public.tarifs_publicite t
     where t.type = p_type and t.duree_jours = p_duree;
    if v_prix is null then
      raise exception 'Cette offre n''a pas encore de prix.';
    end if;
  end if;

  -- Le doublon, oui ; le plafond de 3, non (choix de l'équipe).
  if exists (select 1 from public.campagnes c
              where c.merchant_id = v_merchant
                and c.type = p_type
                and c.product_id is not distinct from p_product
                and c.category_id is not distinct from p_category
                and (c.statut in ('a_payer', 'en_attente') or (c.statut = 'active' and c.fin_at > now()))) then
    raise exception 'Cette campagne est déjà en attente ou en cours.';
  end if;

  insert into public.campagnes (
    merchant_id, type, product_id, category_id, duree_jours, prix_gnf, statut,
    debut_at, fin_at, decidee_par, decidee_at,
    paiement_moyen, paiement_reference, paiement_declare_at,
    paiement_confirme_par, paiement_confirme_at, creee_par_equipe)
  values (
    v_merchant, p_type, p_product, p_category, p_duree, v_prix, 'active',
    now(), now() + make_interval(days => p_duree), (select auth.uid()), now(),
    p_moyen, v_reference, now(),
    (select auth.uid()), now(), (select auth.uid()))
  returning id into v_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'creer_campagne', 'campagne', v_id,
         left(p_type || ' ' || p_duree || ' j, ' || v_prix || ' GNF, ' || p_moyen
              || coalesce(' ' || v_reference, ''), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());

  return v_id;
end;
$$;

revoke execute on function public.creer_campagne_equipe(uuid, text, uuid, int, int, text, text) from public, anon;
grant execute on function public.creer_campagne_equipe(uuid, text, uuid, int, int, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 9. L'équipe note un remboursement
-- ---------------------------------------------------------------------
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

revoke execute on function public.marquer_rembourse(uuid) from public, anon;
grant execute on function public.marquer_rembourse(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 10. La file de l'équipe montre le paiement
-- ---------------------------------------------------------------------
-- Le type de sortie change : supprimer puis recréer. Mêmes colonnes que
-- 0047, dans le même ordre, puis les nouvelles.
drop function public.campagnes_equipe();

create function public.campagnes_equipe()
returns table (
  id                   uuid,
  type                 text,
  statut               text,
  duree_jours          int,
  debut_at             timestamptz,
  fin_at               timestamptz,
  motif                text,
  created_at           timestamptz,
  merchant_id          uuid,
  shop_name            text,
  product_id           uuid,
  produit_titre        text,
  category_id          int,
  category_name        text,
  prix_gnf             int,
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
  select c.id, c.type, c.statut, c.duree_jours, c.debut_at, c.fin_at, c.motif, c.created_at,
         m.id, m.shop_name, pr.id, pr.title, cat.id, cat.name,
         c.prix_gnf, c.paiement_moyen, c.paiement_reference, c.paiement_numero,
         c.paiement_declare_at, c.paiement_confirme_at, c.rembourse_at, c.creee_par_equipe
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


-- ---------------------------------------------------------------------
-- 11. Les revenus, par mois
-- ---------------------------------------------------------------------
-- `campagnes` = nombre de paiements vérifiés DANS le mois (prix > 0 :
-- une campagne offerte n'est pas un revenu). Un mois sans paiement mais
-- avec un remboursement apparaît, avec 0 encaissé.
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
    union all
    select date_trunc('month', c.rembourse_at at time zone 'Africa/Conakry')::date,
           0::bigint, c.prix_gnf::bigint, 0::bigint
      from public.campagnes c
     where c.rembourse_at is not null and c.prix_gnf > 0
  )
  select mv.m, sum(mv.encaisse)::bigint, sum(mv.rembourse)::bigint, sum(mv.n)::bigint
    from mouvements mv
   group by mv.m
   order by mv.m desc;
end;
$$;

revoke execute on function public.revenus_publicite() from public, anon;
grant execute on function public.revenus_publicite() to authenticated;
