-- =====================================================================
-- 0075 : l'équipe range les catégories (visible ou masquée, et rayon)
-- =====================================================================
-- Demande du porteur du projet du 2026-11-11 : depuis `/admin`, l'équipe
-- masque ou réaffiche une catégorie et lui donne son rayon (`famille`).
-- `0074` a ajouté `categories.visible` et `categories.famille` ;
-- `fixer_categorie` (0066) et `retirer_categorie` (0067) ne savent pas
-- les changer, et aucune écriture de table n'est ouverte (0066).
--
-- Constaté en production le 2026-11-11 (lecture seule) : 24 catégories,
-- les seize de la mode visibles et rangées, les huit anciennes masquées
-- sans rayon ; `journal_equipe_action_check` = liste de 0067 ; aucun
-- trigger sur `categories` ; `ranger_categorie` n'existe pas.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `ranger_categorie(p_id, p_visible, p_famille)` : réservée à
--    l'équipe ; fixe `visible` et `famille` d'une catégorie existante.
--    Le rayon est OBLIGATOIRE ('vetements', 'chaussures', 'accessoires') :
--    une catégorie rangée a un rayon, même masquée. `p_visible` nul est
--    refusé.
-- 2. On ne masque pas la DERNIÈRE catégorie visible : le site n'aurait
--    plus rien à proposer. Sous le même verrou que les autres fonctions
--    de catégories : deux masquages simultanés ne passent pas tous deux.
-- 3. Masquer une catégorie qui contient des produits est PERMIS : ses
--    produits sortent de la recherche et des sponsorisés (0074), ne sont
--    ni supprimés ni dépubliés, et y entrer est refusé (trigger 0074) ;
--    la réafficher les fait revenir tels quels.
-- 4. Un appel qui ne change rien n'écrit rien ; sinon une ligne de
--    `journal_equipe` ('ranger_categorie', cible 'categorie'), motif
--    lisible : « Robes : masquée → visible, rayon vêtements → accessoires ».
-- 5. `journal_equipe_action_check` accepte 'ranger_categorie' ; aucune
--    action existante n'est retirée (liste de 0067, constatée en
--    production le 2026-11-11, plus une valeur).
--
-- CE QUI NE CHANGE PAS
-- - `fixer_categorie` : une catégorie créée arrive visible, sans rayon ;
--   l'équipe la range ensuite par cette fonction.
-- - Aucune colonne, aucune policy, aucun droit de table. L'invalidation
--   du cache des catégories est faite par le site.
--
-- À LA PUBLICATION DE `monetisation` : ses réécritures de
-- `journal_equipe_action_check` (0058-0060) doivent aussi garder
-- 'ranger_categorie'.


-- ---------------------------------------------------------------------
-- 1. Le journal connaît le rangement
-- ---------------------------------------------------------------------
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'demasquer_produit', 'ajouter_membre', 'retirer_membre',
                    'fixer_categorie', 'retirer_categorie', 'fixer_ville', 'retirer_ville',
                    'supprimer_produit', 'supprimer_compte',
                    'ranger_categorie'));


-- ---------------------------------------------------------------------
-- 2. Ranger une catégorie
-- ---------------------------------------------------------------------
create or replace function public.ranger_categorie(p_id int, p_visible boolean, p_famille text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien  public.categories%rowtype;
  v_parties text[] := '{}';
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_visible is null then
    raise exception 'Dites si la catégorie est visible ou masquée.';
  end if;
  if p_famille is null or p_famille not in ('vetements', 'chaussures', 'accessoires') then
    raise exception 'Choisissez un rayon : vêtements, chaussures ou accessoires.';
  end if;

  -- Même verrou que `fixer_categorie` et `retirer_categorie` : le
  -- contrôle « dernière visible » ne croise ni un autre masquage ni une
  -- création.
  lock table public.categories in share row exclusive mode;

  select * into v_ancien from public.categories c where c.id = p_id for update;
  if not found then
    raise exception 'Catégorie introuvable.';
  end if;

  if v_ancien.visible = p_visible and v_ancien.famille is not distinct from p_famille then
    return;
  end if;

  if v_ancien.visible and not p_visible
     and not exists (select 1 from public.categories c where c.visible and c.id <> p_id) then
    raise exception 'Impossible de masquer « % » : c''est la dernière catégorie visible, le site n''aurait plus rien à proposer.',
      v_ancien.name;
  end if;

  update public.categories c
     set visible = p_visible, famille = p_famille
   where c.id = p_id;

  if v_ancien.visible <> p_visible then
    v_parties := v_parties || (case when v_ancien.visible then 'visible' else 'masquée' end
                               || ' → ' || case when p_visible then 'visible' else 'masquée' end);
  end if;
  if v_ancien.famille is distinct from p_famille then
    v_parties := v_parties || ('rayon '
      || case v_ancien.famille when 'vetements' then 'vêtements' when 'chaussures' then 'chaussures'
                               when 'accessoires' then 'accessoires' else 'aucun' end
      || ' → '
      || case p_famille when 'vetements' then 'vêtements' when 'chaussures' then 'chaussures'
                        else 'accessoires' end);
  end if;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'ranger_categorie', 'categorie', public.cible_journal_entier(p_id),
         left(v_ancien.name || ' : ' || array_to_string(v_parties, ', '), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.ranger_categorie(int, boolean, text) is
  'Équipe seule (0075) : masque ou réaffiche une catégorie et fixe son rayon (obligatoire). '
  'Refuse de masquer la dernière catégorie visible. Masquer une catégorie qui a des produits est permis : '
  'ils sortent de la recherche et des sponsorisés, sans être supprimés ni dépubliés.';

revoke execute on function public.ranger_categorie(int, boolean, text) from public, anon;
grant execute on function public.ranger_categorie(int, boolean, text) to authenticated;
