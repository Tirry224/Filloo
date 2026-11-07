-- =====================================================================
-- 0049 : une boutique peut s'abonner (Pro, Business), Gratuit est limité
-- =====================================================================
-- Abonnements du document de monétisation, décidés par le porteur du
-- projet le 2026-11-07 : Pro 50 000 GNF par mois, Business 100 000 GNF
-- par mois, un mois à la fois ; Gratuit = 10 produits publiés au plus.
-- Paiement à la main, EXACTEMENT comme la publicité (0048) : mêmes
-- colonnes `paiement_*`, mêmes moyens (`moyens_paiement`, actifs
-- seulement), même vérification par l'équipe. Branche `monetisation` :
-- NE S'APPLIQUE PAS avant que le porteur du projet publie cette branche,
-- et JAMAIS sans 0048 (elle en lit `moyens_paiement`).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Un abonnement ne s'écrit que par les fonctions ci-dessous ; la
--    boutique lit les siens, l'équipe tout. Les prix
--    (`tarifs_abonnement`) se lisent par tous et ne s'écrivent que par
--    `fixer_tarif_abonnement` (équipe, inscrit dans `journal_equipe`).
-- 2. Une boutique en ligne a UNE demande (à payer ou en attente) à la
--    fois, au prix du jour, figé. Elle déclare son paiement par un moyen
--    actif ; l'équipe ne valide une demande payante que déclarée.
-- 3. Une période dure un mois. Si la boutique a déjà la MÊME formule en
--    cours, la nouvelle période commence à la fin de la dernière
--    (renouvellement anticipé, rien de perdu) ; sinon tout de suite. Pas
--    de prorata : Business commence aussitôt, Pro court en parallèle.
-- 4. La formule effective (`formule_de`) est la plus haute dont la
--    période, prolongée de 7 jours de grâce, contient maintenant. Le
--    badge public (`badges_boutiques`) ne compte QUE la période payée.
-- 5. En Gratuit, un 11e produit ne passe pas « active » (trigger, message
--    lisible, code P0001). Chaque nuit, `appliquer_limites_abonnement`
--    masque les plus anciens au-delà des 10 plus récents d'une boutique
--    revenue en Gratuit (`masque_par_limite`) ; jamais rien n'est
--    supprimé. À l'activation d'un abonnement, ils reviennent — sauf ceux
--    que l'équipe a masqués (`masque_par_equipe`, 0046).
-- 6. Les statistiques d'une boutique ne se lisent qu'en Pro ou Business,
--    et seulement les siennes ; les tendances de Filloo, en Business,
--    agrégées sur toute la plateforme, un libellé n'apparaissant qu'à
--    partir de 3 occurrences.
--
-- CHOIX
-- - `masque_par_limite` n'a de sens que sur un produit « hidden »
--   (contrainte) : le trigger l'efface dès que le statut quitte
--   « hidden », et à toute insertion (le commerçant a `insert` sur toute
--   la table, défaut Supabase). Le commerçant n'a pas `update` sur cette
--   colonne (liste blanche de 0002).
-- - La limite compte les produits « active » seulement (décision du
--   2026-11-07, « publiés ») : un « vendu » ne compte pas, mais le
--   remettre en vente est une entrée en « active », donc vérifiée.
-- - Le trigger laisse passer en silence un produit masqué par l'équipe :
--   c'est `products_masque_par_equipe_reste_masque` (0046) qui le refuse,
--   avec SON message.
-- - Une interruption par l'équipe coupe la formule tout de suite, sans
--   grâce (statut ≠ « active ») ; les produits en trop sont masqués à la
--   passe de la nuit suivante, pas dans le geste de l'équipe.
-- - Retour des produits : seulement ceux qui ont encore une photo (sinon
--   `products_check_publishable` ferait échouer l'activation entière).
-- - Statistiques : `contacts` = `contact_ouvert` (clic « Contacter »,
--   connecté ou non), `whatsapp` = `whatsapp_ouvert`. Seul le SITE écrit
--   ces mesures (l'app mobile n'en écrit aucune, constaté le 2026-11-07).
--   Elles sont purgées à 13 mois (0028) : sans effet sur 90 jours.
-- - Tendances « categorie » = catégories choisies dans la recherche
--   (événement `recherche` avec `category_id`).
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE (vérifiée dans `filloo-mobile`,
-- 2026-11-07) : elle publie par `update products set status = 'active'`
-- (création en deux temps, republication, remise en vente) et montre tel
-- quel le message d'une erreur P0001. Le seul changement visible est le
-- refus voulu au 11e produit d'une boutique Gratuite. Elle n'appelle
-- aucune fonction ajoutée ici ; la colonne ajoutée a un défaut.


-- ---------------------------------------------------------------------
-- 1. Les prix
-- ---------------------------------------------------------------------
create table public.tarifs_abonnement (
  formule     text primary key check (formule in ('pro', 'business')),
  id          uuid not null unique default gen_random_uuid(),
  prix_gnf    int  not null check (prix_gnf >= 0),
  modifie_par uuid references public.equipe(auth_user_id) on delete set null,
  modifie_at  timestamptz
);

comment on table public.tarifs_abonnement is
  'Prix d''un mois d''abonnement (0049), lu par tous. Écrit SEULEMENT par fixer_tarif_abonnement. `id` sert de cible dans journal_equipe.';

alter table public.tarifs_abonnement enable row level security;
revoke all on public.tarifs_abonnement from anon, authenticated;
grant select on public.tarifs_abonnement to anon, authenticated;

create policy "tarifs_abonnement: tout le monde lit les prix"
  on public.tarifs_abonnement for select
  to anon, authenticated
  using (true);

-- Prix décidés par le porteur du projet le 2026-11-07.
insert into public.tarifs_abonnement (formule, prix_gnf) values
  ('pro', 50000), ('business', 100000);


-- ---------------------------------------------------------------------
-- 2. Les abonnements
-- ---------------------------------------------------------------------
create table public.abonnements (
  id                    uuid primary key default gen_random_uuid(),
  merchant_id           uuid not null references public.merchants(id) on delete cascade,
  formule               text not null check (formule in ('pro', 'business')),
  statut                text not null default 'en_attente'
                        check (statut in ('a_payer', 'en_attente', 'active', 'refusee', 'annulee', 'interrompue')),
  prix_gnf              int  not null check (prix_gnf >= 0),
  debut_at              timestamptz,
  fin_at                timestamptz,
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
  -- Motif de refus ou d'interruption.
  motif                 text check (motif is null or char_length(motif) between 3 and 500),
  decidee_par           uuid references public.equipe(auth_user_id) on delete set null,
  decidee_at            timestamptz,
  created_at            timestamptz not null default now(),

  constraint abonnements_active_a_une_periode check (
    statut <> 'active' or (debut_at is not null and fin_at is not null and fin_at >= debut_at)
  ),
  constraint abonnements_refus_et_interruption_motives check (
    statut not in ('refusee', 'interrompue') or motif is not null
  ),
  constraint abonnements_a_payer_a_un_prix check (statut <> 'a_payer' or prix_gnf > 0),
  constraint abonnements_offert_est_gratuit check (paiement_moyen is distinct from 'offert' or prix_gnf = 0),
  constraint abonnements_rembourse_seulement_si_payant check (rembourse_at is null or prix_gnf > 0)
);

comment on table public.abonnements is
  'Abonnements Pro / Business (0049). Écrits SEULEMENT par demander_abonnement, declarer_paiement_abonnement, annuler_abonnement, decider_abonnement, creer_abonnement_equipe, interrompre_abonnement, marquer_abonnement_rembourse. « Terminé » = active et fin_at passée.';

-- Une seule demande ouverte par boutique, même sous deux appels simultanés.
create unique index abonnements_une_demande_par_boutique
  on public.abonnements (merchant_id) where statut in ('a_payer', 'en_attente');
create index abonnements_par_boutique_idx on public.abonnements (merchant_id, created_at desc);
create index abonnements_actifs_idx on public.abonnements (merchant_id, fin_at) where statut = 'active';
create index abonnements_paiement_confirme_idx on public.abonnements (paiement_confirme_at)
  where paiement_confirme_at is not null;
create index abonnements_rembourse_idx on public.abonnements (rembourse_at)
  where rembourse_at is not null;

alter table public.abonnements enable row level security;
revoke all on public.abonnements from anon;
revoke insert, update, delete, truncate, references, trigger on public.abonnements from authenticated;

create policy "abonnements: la boutique lit les siens, l'equipe tout"
  on public.abonnements for select
  to authenticated
  using (
    merchant_id = (select public.my_merchant_id())
    or (select public.je_suis_de_l_equipe())
  );


-- ---------------------------------------------------------------------
-- 3. L'historique de l'équipe connaît les abonnements
-- ---------------------------------------------------------------------
-- Mêmes valeurs que 0048, plus celles des abonnements.
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'fixer_tarif', 'fixer_moyen_paiement', 'creer_campagne', 'rembourser_campagne',
                    'fixer_tarif_abonnement', 'valider_abonnement', 'refuser_abonnement',
                    'creer_abonnement', 'interrompre_abonnement', 'rembourser_abonnement'));

alter table public.journal_equipe drop constraint journal_equipe_cible_type_check;
alter table public.journal_equipe add constraint journal_equipe_cible_type_check
  check (cible_type in ('profil', 'produit', 'signalement', 'campagne', 'tarif', 'moyen_paiement',
                        'tarif_abonnement', 'abonnement'));


-- ---------------------------------------------------------------------
-- 4. La formule d'une boutique
-- ---------------------------------------------------------------------
-- Interne : lue par le trigger, les statistiques et `ma_formule`. Pas
-- exécutable par anon ni authenticated (elle dirait la formule de
-- n'importe quelle boutique, grâce comprise).
create or replace function public.formule_de(p_merchant uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select a.formule
      from public.abonnements a
     where a.merchant_id = p_merchant
       and a.statut = 'active'
       and a.debut_at <= now()
       and now() <= a.fin_at + interval '7 days'
     order by case a.formule when 'business' then 2 else 1 end desc
     limit 1
  ), 'gratuit');
$$;

revoke execute on function public.formule_de(uuid) from public, anon, authenticated;


-- La boutique de l'appelant ; aucune ligne si l'appelant n'a pas de
-- boutique. `fin_at` = la fin la plus lointaine de la formule effective
-- (renouvellements compris) ; `en_grace` = cette fin est passée.
create or replace function public.ma_formule()
returns table (formule text, fin_at timestamptz, en_grace boolean, limite_produits int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant uuid := public.my_merchant_id();
  v_formule  text;
  v_fin      timestamptz;
begin
  if v_merchant is null then
    return;
  end if;
  v_formule := public.formule_de(v_merchant);

  select max(a.fin_at) into v_fin
    from public.abonnements a
   where a.merchant_id = v_merchant and a.statut = 'active' and a.formule = v_formule;

  return query select v_formule, v_fin, coalesce(v_fin <= now(), false),
                      case when v_formule = 'gratuit' then 10 end;
end;
$$;

revoke execute on function public.ma_formule() from public, anon;
grant execute on function public.ma_formule() to authenticated;


-- Le badge public : période PAYÉE seulement (pas la grâce), boutiques en
-- ligne seulement (mêmes règles que `merchant_is_public`, 0013, refaites
-- à la main). 200 boutiques au plus par appel.
create or replace function public.badges_boutiques(p_merchants uuid[])
returns table (merchant_id uuid, formule text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (a.merchant_id) a.merchant_id, a.formule
    from public.abonnements a
    join public.merchants m  on m.id = a.merchant_id
    join public.profiles  pf on pf.id = m.profile_id
   where a.merchant_id = any (p_merchants[1:200])
     and a.statut = 'active'
     and a.debut_at <= now() and now() < a.fin_at
     and m.status = 'approved'
     and not pf.is_suspended
     and not pf.is_deleted
   order by a.merchant_id, case a.formule when 'business' then 2 else 1 end desc;
$$;

revoke execute on function public.badges_boutiques(uuid[]) from public;
grant execute on function public.badges_boutiques(uuid[]) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. La limite de la formule Gratuite
-- ---------------------------------------------------------------------
alter table public.products
  add column masque_par_limite boolean not null default false;

alter table public.products
  add constraint products_masque_par_limite_est_masque check (not masque_par_limite or status = 'hidden');

comment on column public.products.masque_par_limite is
  'Masqué par appliquer_limites_abonnement (boutique revenue en Gratuit, au-delà de 10) ; revient par restaurer_produits_masques. Jamais supprimé.';

create or replace function public.produit_respecte_la_formule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Le drapeau ne vit que sur un produit masqué, et ne s'écrit pas à la création.
  if tg_op = 'INSERT' or new.status <> 'hidden' then
    new.masque_par_limite := false;
  end if;

  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status <> 'active')
     and not new.masque_par_equipe
  then
    -- Deux publications simultanées ne franchissent pas ensemble la limite.
    perform 1 from public.merchants m where m.id = new.merchant_id for update;
    if public.formule_de(new.merchant_id) = 'gratuit'
       and (select count(*) from public.products p
             where p.merchant_id = new.merchant_id and p.status = 'active' and p.id <> new.id) >= 10
    then
      raise exception 'Formule Gratuite : 10 produits publiés au plus. Passez à Pro pour en publier davantage.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.produit_respecte_la_formule() from public, anon, authenticated;

create trigger products_respecte_la_formule
  before insert or update of status on public.products
  for each row execute function public.produit_respecte_la_formule();


-- Chaque nuit : une boutique en Gratuit garde ses 10 produits publiés les
-- plus récents ; les autres passent « hidden » avec `masque_par_limite`.
create or replace function public.appliquer_limites_abonnement()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products p
     set status = 'hidden', masque_par_limite = true
    from (
      select pr.id,
             row_number() over (partition by pr.merchant_id order by pr.created_at desc, pr.id desc) as rang
        from public.products pr
       where pr.status = 'active'
         and pr.merchant_id in (select x.merchant_id from public.products x
                                 where x.status = 'active'
                                 group by x.merchant_id having count(*) > 10)
    ) r
   where p.id = r.id
     and r.rang > 10
     and public.formule_de(p.merchant_id) = 'gratuit';
$$;

revoke execute on function public.appliquer_limites_abonnement() from public, anon, authenticated;
grant execute on function public.appliquer_limites_abonnement() to service_role;

-- Comme 0028 : dans la base (pg_cron), conditionnel pour le PostgreSQL
-- local des tests ; même nom = même tâche, rejouable. 3 h 41 UTC.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('appliquer-limites-abonnement', '41 3 * * *',
                          'select public.appliquer_limites_abonnement()');
  end if;
end $$;


-- À l'activation : les produits masqués par la limite reviennent, si la
-- formule n'est plus Gratuite. Jamais un produit masqué par l'équipe,
-- jamais un produit sans photo (il ferait échouer l'activation).
create or replace function public.restaurer_produits_masques(p_merchant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.formule_de(p_merchant) = 'gratuit' then
    return;
  end if;

  update public.products p
     set status = 'active', masque_par_limite = false
   where p.merchant_id = p_merchant
     and p.status = 'hidden'
     and p.masque_par_limite
     and not p.masque_par_equipe
     and exists (select 1 from public.product_images pi where pi.product_id = p.id)
     and exists (select 1 from public.merchants m where m.id = p_merchant and m.status = 'approved');
end;
$$;

revoke execute on function public.restaurer_produits_masques(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. L'équipe fixe les prix
-- ---------------------------------------------------------------------
create or replace function public.fixer_tarif_abonnement(p_formule text, p_prix int)
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
  if p_prix is null or p_prix not between 0 and 100000000 then
    raise exception 'Le prix va de 0 à 100 000 000 GNF.';
  end if;

  select t.prix_gnf into v_ancien from public.tarifs_abonnement t
   where t.formule = p_formule for update;

  insert into public.tarifs_abonnement as t (formule, prix_gnf, modifie_par, modifie_at)
  values (p_formule, p_prix, (select auth.uid()), now())
  on conflict (formule) do update
     set prix_gnf = excluded.prix_gnf, modifie_par = excluded.modifie_par, modifie_at = excluded.modifie_at
  returning t.id into v_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'fixer_tarif_abonnement', 'tarif_abonnement', v_id,
         p_formule || ' : ' || coalesce(v_ancien::text, 'aucun') || ' → ' || p_prix || ' GNF'
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.fixer_tarif_abonnement(text, int) from public, anon;
grant execute on function public.fixer_tarif_abonnement(text, int) to authenticated;


-- ---------------------------------------------------------------------
-- 7. La boutique demande, déclare son paiement, annule
-- ---------------------------------------------------------------------
create or replace function public.demander_abonnement(p_formule text)
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

  if p_formule is null or p_formule not in ('pro', 'business') then
    raise exception 'Formule inconnue : Pro ou Business.';
  end if;

  select t.prix_gnf into v_prix from public.tarifs_abonnement t where t.formule = p_formule;
  if v_prix is null then
    raise exception 'Cette formule n''a pas encore de prix.';
  end if;

  if exists (select 1 from public.abonnements a
              where a.merchant_id = v_merchant and a.statut in ('a_payer', 'en_attente')) then
    raise exception 'Une demande d''abonnement est déjà en cours : payez-la ou annulez-la d''abord.';
  end if;

  insert into public.abonnements (merchant_id, formule, prix_gnf, statut)
  values (v_merchant, p_formule, v_prix, case when v_prix > 0 then 'a_payer' else 'en_attente' end)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.demander_abonnement(text) from public, anon;
grant execute on function public.demander_abonnement(text) to authenticated;


create or replace function public.declarer_paiement_abonnement(
  p_id uuid, p_moyen text, p_reference text, p_numero text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant  uuid;
  v_a         public.abonnements%rowtype;
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

  select * into v_a from public.abonnements a
   where a.id = p_id and a.merchant_id = v_merchant
     for update;
  if not found then
    raise exception 'Abonnement introuvable.';
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
    raise exception 'Cet abonnement n''attend pas de paiement.';
  end if;

  update public.abonnements
     set statut = 'en_attente',
         paiement_moyen = p_moyen,
         paiement_reference = v_reference,
         paiement_numero = v_numero,
         paiement_declare_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.declarer_paiement_abonnement(uuid, text, text, text) from public, anon;
grant execute on function public.declarer_paiement_abonnement(uuid, text, text, text) to authenticated;


-- Le commerçant suspendu peut encore annuler sa demande. Un abonnement en
-- cours ne s'annule pas (c'est l'équipe qui interrompt).
create or replace function public.annuler_abonnement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.abonnements%rowtype;
begin
  select * into v_a from public.abonnements a
   where a.id = p_id and a.merchant_id = public.my_merchant_id()
     for update;
  if not found then
    raise exception 'Abonnement introuvable.';
  end if;
  if v_a.statut not in ('a_payer', 'en_attente') then
    raise exception 'Cet abonnement ne peut plus être annulé.';
  end if;

  update public.abonnements set statut = 'annulee' where id = p_id;
end;
$$;

revoke execute on function public.annuler_abonnement(uuid) from public, anon;
grant execute on function public.annuler_abonnement(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 8. Le début d'une période
-- ---------------------------------------------------------------------
-- Interne. La fin la plus lointaine d'un abonnement de la MÊME formule
-- encore en cours, sinon maintenant. L'appelant a verrouillé la boutique.
create or replace function public.debut_prochaine_periode(p_merchant uuid, p_formule text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(now(), coalesce((
    select max(a.fin_at) from public.abonnements a
     where a.merchant_id = p_merchant and a.formule = p_formule
       and a.statut = 'active' and a.fin_at > now()
  ), now()));
$$;

revoke execute on function public.debut_prochaine_periode(uuid, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 9. L'équipe décide (et vérifie le paiement)
-- ---------------------------------------------------------------------
create or replace function public.decider_abonnement(p_id uuid, p_accepter boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a     public.abonnements%rowtype;
  v_motif text := btrim(coalesce(p_motif, ''));
  v_paye  boolean;
  v_debut timestamptz;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_accepter is null then
    raise exception 'Acceptez ou refusez.';
  end if;

  select * into v_a from public.abonnements a where a.id = p_id for update;
  if not found then
    raise exception 'Abonnement introuvable.';
  end if;
  if v_a.statut not in ('a_payer', 'en_attente') then
    raise exception 'Cet abonnement a déjà été décidé.';
  end if;

  v_paye := v_a.prix_gnf > 0;

  if p_accepter then
    if v_a.statut = 'a_payer' or (v_paye and v_a.paiement_declare_at is null) then
      raise exception 'Le paiement n''est pas encore déclaré.';
    end if;
    if not public.merchant_is_public(v_a.merchant_id) then
      raise exception 'Cette boutique n''est plus en ligne.';
    end if;

    perform 1 from public.merchants m where m.id = v_a.merchant_id for update;
    v_debut := public.debut_prochaine_periode(v_a.merchant_id, v_a.formule);

    update public.abonnements
       set statut = 'active',
           debut_at = v_debut,
           fin_at = v_debut + interval '1 month',
           decidee_par = (select auth.uid()),
           decidee_at = now(),
           paiement_confirme_par = case when v_paye then (select auth.uid()) end,
           paiement_confirme_at  = case when v_paye then now() end
     where id = p_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'valider_abonnement', 'abonnement', p_id,
           case when v_paye then left('Paiement vérifié : ' || v_a.prix_gnf || ' GNF, '
                                      || v_a.paiement_moyen || ' ' || v_a.paiement_reference, 500) end
      from public.equipe e where e.auth_user_id = (select auth.uid());

    perform public.restaurer_produits_masques(v_a.merchant_id);
  else
    if char_length(v_motif) not between 3 and 500 then
      raise exception 'Le motif fait de 3 à 500 caractères.';
    end if;

    update public.abonnements
       set statut = 'refusee',
           motif = v_motif,
           decidee_par = (select auth.uid()),
           decidee_at = now()
     where id = p_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'refuser_abonnement', 'abonnement', p_id, v_motif
      from public.equipe e where e.auth_user_id = (select auth.uid());
  end if;
end;
$$;

revoke execute on function public.decider_abonnement(uuid, boolean, text) from public, anon;
grant execute on function public.decider_abonnement(uuid, boolean, text) to authenticated;


-- ---------------------------------------------------------------------
-- 10. L'équipe crée un abonnement déjà payé, ou offert
-- ---------------------------------------------------------------------
-- En cours tout de suite (ou à la suite de la même formule). Une demande
-- ouverte de la boutique n'est pas touchée : l'équipe la refuse ou la
-- laisse annuler.
create or replace function public.creer_abonnement_equipe(
  p_merchant  uuid,
  p_formule   text,
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
  v_debut     timestamptz;
  v_id        uuid;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

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

  if p_formule is null or p_formule not in ('pro', 'business') then
    raise exception 'Formule inconnue : Pro ou Business.';
  end if;
  if p_moyen is null or p_moyen not in ('especes', 'orange_money', 'mtn_momo', 'offert') then
    raise exception 'Moyen : espèces, Orange Money, MTN MoMo ou offert.';
  end if;
  if v_reference is not null and char_length(v_reference) not between 3 and 60 then
    raise exception 'La référence fait de 3 à 60 caractères.';
  end if;

  if p_moyen = 'offert' then
    v_prix := 0;
  else
    select t.prix_gnf into v_prix from public.tarifs_abonnement t where t.formule = p_formule;
    if v_prix is null then
      raise exception 'Cette formule n''a pas encore de prix.';
    end if;
  end if;

  v_debut := public.debut_prochaine_periode(v_merchant, p_formule);

  insert into public.abonnements (
    merchant_id, formule, prix_gnf, statut, debut_at, fin_at, decidee_par, decidee_at,
    paiement_moyen, paiement_reference, paiement_declare_at,
    paiement_confirme_par, paiement_confirme_at, creee_par_equipe)
  values (
    v_merchant, p_formule, v_prix, 'active', v_debut, v_debut + interval '1 month', (select auth.uid()), now(),
    p_moyen, v_reference, now(),
    (select auth.uid()), now(), (select auth.uid()))
  returning id into v_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'creer_abonnement', 'abonnement', v_id,
         left(p_formule || ', ' || v_prix || ' GNF, ' || p_moyen || coalesce(' ' || v_reference, ''), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());

  perform public.restaurer_produits_masques(v_merchant);

  return v_id;
end;
$$;

revoke execute on function public.creer_abonnement_equipe(uuid, text, text, text) from public, anon;
grant execute on function public.creer_abonnement_equipe(uuid, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 11. L'équipe interrompt, note un remboursement
-- ---------------------------------------------------------------------
-- En cours OU programmé (renouvellement anticipé) : la période s'arrête
-- maintenant ; une période pas encore commencée devient de durée nulle.
create or replace function public.interrompre_abonnement(p_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a     public.abonnements%rowtype;
  v_motif text := btrim(coalesce(p_motif, ''));
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select * into v_a from public.abonnements a where a.id = p_id for update;
  if not found then
    raise exception 'Abonnement introuvable.';
  end if;
  if not (v_a.statut = 'active' and v_a.fin_at > now()) then
    raise exception 'Seul un abonnement en cours s''interrompt.';
  end if;

  update public.abonnements
     set statut = 'interrompue', motif = v_motif,
         debut_at = least(debut_at, now()), fin_at = now()
   where id = p_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'interrompre_abonnement', 'abonnement', p_id, v_motif
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.interrompre_abonnement(uuid, text) from public, anon;
grant execute on function public.interrompre_abonnement(uuid, text) to authenticated;


create or replace function public.marquer_abonnement_rembourse(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.abonnements%rowtype;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  select * into v_a from public.abonnements a where a.id = p_id for update;
  if not found then
    raise exception 'Abonnement introuvable.';
  end if;
  if v_a.rembourse_at is not null then
    raise exception 'Cet abonnement est déjà remboursé.';
  end if;
  if v_a.prix_gnf = 0
     or (v_a.paiement_declare_at is null and v_a.paiement_confirme_at is null) then
    raise exception 'Rien n''a été payé pour cet abonnement.';
  end if;
  if v_a.statut not in ('refusee', 'annulee', 'interrompue') then
    raise exception 'Seul un abonnement refusé, annulé ou interrompu se rembourse.';
  end if;

  update public.abonnements
     set rembourse_par = (select auth.uid()), rembourse_at = now()
   where id = p_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'rembourser_abonnement', 'abonnement', p_id,
         left(v_a.prix_gnf || ' GNF, ' || coalesce(v_a.paiement_moyen, '?')
              || coalesce(' ' || v_a.paiement_reference, ''), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

revoke execute on function public.marquer_abonnement_rembourse(uuid) from public, anon;
grant execute on function public.marquer_abonnement_rembourse(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 12. La file de l'équipe, les revenus
-- ---------------------------------------------------------------------
create or replace function public.abonnements_equipe()
returns table (
  id                   uuid,
  formule              text,
  statut               text,
  prix_gnf             int,
  debut_at             timestamptz,
  fin_at               timestamptz,
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
  select a.id, a.formule, a.statut, a.prix_gnf, a.debut_at, a.fin_at, a.motif, a.created_at,
         m.id, m.shop_name,
         a.paiement_moyen, a.paiement_reference, a.paiement_numero,
         a.paiement_declare_at, a.paiement_confirme_at, a.rembourse_at, a.creee_par_equipe
    from public.abonnements a
    join public.merchants m on m.id = a.merchant_id
   order by a.created_at desc, a.id
   limit 200;
end;
$$;

revoke execute on function public.abonnements_equipe() from public, anon;
grant execute on function public.abonnements_equipe() to authenticated;


-- Comme `revenus_publicite` (0048) : encaissé au mois de la VÉRIFICATION,
-- remboursé au mois du REMBOURSEMENT, heure de Conakry ; un offert n'est
-- pas un revenu.
create or replace function public.revenus_abonnements()
returns table (mois date, encaisse_gnf bigint, rembourse_gnf bigint, abonnements bigint)
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
      from public.abonnements a
     where a.paiement_confirme_at is not null and a.prix_gnf > 0
    union all
    select date_trunc('month', a.rembourse_at at time zone 'Africa/Conakry')::date,
           0::bigint, a.prix_gnf::bigint, 0::bigint
      from public.abonnements a
     where a.rembourse_at is not null and a.prix_gnf > 0
  )
  select mv.m, sum(mv.encaisse)::bigint, sum(mv.rembourse)::bigint, sum(mv.n)::bigint
    from mouvements mv
   group by mv.m
   order by mv.m desc;
end;
$$;

revoke execute on function public.revenus_abonnements() from public, anon;
grant execute on function public.revenus_abonnements() to authenticated;


-- ---------------------------------------------------------------------
-- 13. Les statistiques
-- ---------------------------------------------------------------------
-- Lues par boutique et par période : l'index de 0024 est par nom.
create index analytics_events_par_boutique_idx
  on public.analytics_events (merchant_id, occurred_at) where merchant_id is not null;

-- Jours à l'heure de Conakry (UTC+0), du jour J-(p_jours-1) à aujourd'hui,
-- chacun présent même à zéro.
create or replace function public.statistiques_boutique(p_jours int default 30)
returns table (jour date, boutique_vues bigint, produits_vus bigint, contacts bigint, whatsapp bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant uuid := public.my_merchant_id();
  v_d1       date := (now() at time zone 'Africa/Conakry')::date;
  v_d0       date;
begin
  if v_merchant is null or public.formule_de(v_merchant) not in ('pro', 'business') then
    raise exception 'Réservé aux formules Pro et Business.';
  end if;
  if p_jours is null or p_jours not between 7 and 90 then
    raise exception 'La période va de 7 à 90 jours.';
  end if;
  v_d0 := v_d1 - (p_jours - 1);

  return query
  with jours as (
    select v_d0 + i as d from generate_series(0, p_jours - 1) as i
  ),
  ev as (
    select (e.occurred_at at time zone 'Africa/Conakry')::date as d, e.name as nom
      from public.analytics_events e
     where e.merchant_id = v_merchant
       and e.occurred_at >= (v_d0::timestamp at time zone 'Africa/Conakry')
       and e.name in ('boutique_vue', 'produit_vu', 'contact_ouvert', 'whatsapp_ouvert')
  )
  select j.d,
         count(ev.nom) filter (where ev.nom = 'boutique_vue'),
         count(ev.nom) filter (where ev.nom = 'produit_vu'),
         count(ev.nom) filter (where ev.nom = 'contact_ouvert'),
         count(ev.nom) filter (where ev.nom = 'whatsapp_ouvert')
    from jours j
    left join ev on ev.d = j.d
   group by j.d
   order by j.d;
end;
$$;

revoke execute on function public.statistiques_boutique(int) from public, anon;
grant execute on function public.statistiques_boutique(int) to authenticated;


-- Ses produits seulement (tous statuts), ceux qui ont au moins une mesure.
create or replace function public.produits_les_plus_vus(p_jours int default 30)
returns table (product_id uuid, titre text, vues bigint, contacts bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant uuid := public.my_merchant_id();
  v_d0       date;
begin
  if v_merchant is null or public.formule_de(v_merchant) not in ('pro', 'business') then
    raise exception 'Réservé aux formules Pro et Business.';
  end if;
  if p_jours is null or p_jours not between 7 and 90 then
    raise exception 'La période va de 7 à 90 jours.';
  end if;
  v_d0 := (now() at time zone 'Africa/Conakry')::date - (p_jours - 1);

  return query
  select pr.id, pr.title,
         count(e.id) filter (where e.name = 'produit_vu'),
         count(e.id) filter (where e.name = 'contact_ouvert')
    from public.products pr
    join public.analytics_events e
      on e.product_id = pr.id
     and e.merchant_id = v_merchant
     and e.occurred_at >= (v_d0::timestamp at time zone 'Africa/Conakry')
     and e.name in ('produit_vu', 'contact_ouvert')
   where pr.merchant_id = v_merchant
   group by pr.id, pr.title
   order by 3 desc, 4 desc, pr.title, pr.id
   limit 10;
end;
$$;

revoke execute on function public.produits_les_plus_vus(int) from public, anon;
grant execute on function public.produits_les_plus_vus(int) to authenticated;


-- Toute la plateforme, jamais une boutique : les mots cherchés (normalisés
-- en minuscules, espaces resserrés), ceux qui n'ont rien donné, les
-- catégories choisies. 10 par genre ; 3 occurrences au moins.
create or replace function public.tendances_filloo(p_jours int default 30)
returns table (genre text, libelle text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant uuid := public.my_merchant_id();
  v_d0       date;
begin
  if v_merchant is null or public.formule_de(v_merchant) <> 'business' then
    raise exception 'Réservé à la formule Business.';
  end if;
  if p_jours is null or p_jours not between 7 and 90 then
    raise exception 'La période va de 7 à 90 jours.';
  end if;
  v_d0 := (now() at time zone 'Africa/Conakry')::date - (p_jours - 1);

  return query
  with ev as (
    select lower(regexp_replace(btrim(e.search_query), '\s+', ' ', 'g')) as mots,
           e.result_count as n_res, e.category_id as cat
      from public.analytics_events e
     where e.name = 'recherche'
       and e.occurred_at >= (v_d0::timestamp at time zone 'Africa/Conakry')
  ),
  tout as (
    select 'recherche'::text as g, ev.mots as l, count(*) as n
      from ev where ev.mots is not null and ev.mots <> '' group by ev.mots
    union all
    select 'recherche_sans_resultat', ev.mots, count(*)
      from ev where ev.mots is not null and ev.mots <> '' and ev.n_res = 0 group by ev.mots
    union all
    select 'categorie', c.name, count(*)
      from ev join public.categories c on c.id = ev.cat group by c.name
  ),
  classe as (
    select t.g, t.l, t.n, row_number() over (partition by t.g order by t.n desc, t.l) as rang
      from tout t where t.n >= 3
  )
  select k.g, k.l, k.n::bigint from classe k where k.rang <= 10 order by k.g, k.n desc, k.l;
end;
$$;

revoke execute on function public.tendances_filloo(int) from public, anon;
grant execute on function public.tendances_filloo(int) to authenticated;
