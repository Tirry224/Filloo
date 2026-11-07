-- =====================================================================
-- 0064 : l'équipe retrouve n'importe quel produit, et peut lever son
--        propre masquage
-- =====================================================================
-- Décision du porteur du projet du 2026-11-07 : tout s'administre depuis
-- `/admin`. 0046 avait laissé « démasquer » au tableau de bord
-- (`service_role`) faute de demande ; la voici.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Seule l'équipe lit la liste des produits (`equipe_produits`), TOUS
--    statuts confondus (brouillons compris), et seule elle lève un
--    masquage de l'équipe (`demasquer_produit`).
-- 2. Lever le masquage NE REMET PAS le produit en ligne : il reste
--    `hidden`, case `masque_par_equipe` décochée. C'est le commerçant qui
--    décide de le republier, par son geste habituel (`update status`,
--    site et app), avec les contrôles habituels (photo, 0011). L'équipe
--    ne publie jamais à la place d'un commerçant.
-- 3. Le démasquage porte un motif de 3 à 500 caractères et s'inscrit au
--    journal (`demasquer_produit`), dans la même transaction.
-- 4. Rappeler `demasquer_produit` sur un produit non masqué par l'équipe
--    ne fait rien et n'écrit rien (même règle que `masquer_produit`,
--    0046 : un essai interrompu se relance sans risque).
--
-- CHOIX
-- - Filtre `p_statut` : un des statuts ('active', 'sold', 'draft',
--   'hidden' : le statut tel quel, masqués par l'équipe compris), ou
--   'masque_equipe' (la case). Toute autre valeur est refusée plutôt que
--   d'afficher une liste vide trompeuse.
-- - Recherche sans accents ni casse sur le titre, le nom de boutique et
--   la catégorie ; un uuid de produit collé le retrouve.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE : deux fonctions ajoutées et une
-- valeur de journal de plus. Un produit démasqué est un produit `hidden`
-- ordinaire, état que l'app connaît déjà (son bouton « republier »).


-- ---------------------------------------------------------------------
-- 1. Le journal connaît le démasquage
-- ---------------------------------------------------------------------
-- Liste reprise de 0047 (constatée en production le 2026-11-07), une
-- valeur ajoutée. ATTENTION à la publication de la branche
-- `monetisation` : ses réécritures de ces contraintes doivent garder les
-- valeurs de 0064-0066.
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'demasquer_produit'));


-- ---------------------------------------------------------------------
-- 2. La liste des produits
-- ---------------------------------------------------------------------
create or replace function public.equipe_produits(
  p_recherche text default null,
  p_statut    text default null,
  p_limite    int  default 50
)
returns table (
  product_id        uuid,
  titre             text,
  statut            text,
  prix              bigint,
  merchant_id       uuid,
  shop_name         text,
  categorie         text,
  masque_par_equipe boolean,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q       text := nullif(btrim(coalesce(p_recherche, '')), '');
  v_statut  text := nullif(btrim(coalesce(p_statut, '')), '');
  v_n       text;
  v_echappe text;
  v_limite  int  := least(greatest(coalesce(p_limite, 50), 1), 200);
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if v_statut is not null and v_statut not in ('active', 'sold', 'draft', 'hidden', 'masque_equipe') then
    raise exception 'Filtre de produits inconnu.';
  end if;

  if v_q is not null then
    v_n := lower(extensions.unaccent(left(v_q, 80)));
    v_echappe := replace(replace(replace(v_n, '\', '\\'), '%', '\%'), '_', '\_');
  end if;

  return query
  select pr.id, pr.title, pr.status::text, pr.price_gnf, m.id, m.shop_name, c.name,
         pr.masque_par_equipe, pr.created_at
    from public.products pr
    join public.merchants m  on m.id = pr.merchant_id
    join public.categories c on c.id = pr.category_id
   cross join lateral (
     select lower(extensions.unaccent(pr.title))     as n_titre,
            lower(extensions.unaccent(m.shop_name))  as n_boutique,
            lower(extensions.unaccent(c.name))       as n_categorie
   ) n
   where (v_statut is null
          or (v_statut = 'masque_equipe' and pr.masque_par_equipe)
          or (v_statut <> 'masque_equipe' and pr.status::text = v_statut))
     and (v_q is null
          or pr.id::text = lower(v_q)
          or n.n_titre     like '%' || v_echappe || '%'
          or n.n_boutique  like '%' || v_echappe || '%'
          or n.n_categorie like '%' || v_echappe || '%')
   order by case
              when v_q is null then 0
              when pr.id::text = lower(v_q) or n.n_titre = v_n or n.n_boutique = v_n then 0
              when n.n_titre like v_echappe || '%' or n.n_boutique like v_echappe || '%' then 1
              else 2
            end,
            pr.created_at desc, pr.id
   limit v_limite;
end;
$$;

comment on function public.equipe_produits(text, text, int) is
  'Équipe seule (0064) : tous les produits, filtre par statut ou « masque_equipe », recherche sans accents.';

revoke execute on function public.equipe_produits(text, text, int) from public, anon;
grant execute on function public.equipe_produits(text, text, int) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Lever le masquage de l'équipe
-- ---------------------------------------------------------------------
-- `status` reste `hidden` : la case se décoche, le commerçant republie
-- s'il le veut. Le déclencheur de 0046 (`hidden` tant que la case est
-- cochée) n'a rien à refuser ici.
create or replace function public.demasquer_produit(p_produit uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif  text := btrim(coalesce(p_motif, ''));
  v_masque boolean;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select pr.masque_par_equipe into v_masque
    from public.products pr where pr.id = p_produit
     for update;
  if not found then
    raise exception 'Produit introuvable.';
  end if;
  if not v_masque then
    return;
  end if;

  update public.products pr
     set masque_par_equipe = false, status = 'hidden'
   where pr.id = p_produit;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'demasquer_produit', 'produit', p_produit, v_motif
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.demasquer_produit(uuid, text) is
  'Équipe seule (0064) : lève masque_par_equipe ; le produit reste « hidden », son commerçant le republie.';

revoke execute on function public.demasquer_produit(uuid, text) from public, anon;
grant execute on function public.demasquer_produit(uuid, text) to authenticated;
