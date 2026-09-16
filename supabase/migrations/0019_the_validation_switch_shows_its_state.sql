-- =====================================================================
-- 0019 — La case « valider » montre son état au lieu de l'effacer
-- =====================================================================
-- Constaté le 2026-09-16 par le porteur du projet : « je n'arrive
-- toujours pas à modifier le statut d'un marchand ». Diagnostic mené
-- sur la vraie base avant d'écrire une ligne.
--
-- CE QUI N'ÉTAIT PAS EN CAUSE, et qu'il fallait éliminer d'abord :
--   - le RLS : rejoué en `service_role` (le rôle de l'éditeur de table)
--     et en `postgres`, l'écriture passe dans les deux cas ;
--   - la chaîne côté commerçant : rejouée avec le JWT du vrai
--     commerçant, `status = 'approved'` lui rend aussitôt sa boutique
--     (`my_merchant_id`, `merchant_is_public`, et donc `/vendeur`) ;
--   - les policies, les triggers de 0012 et la contrainte de motif :
--     tous corrects.
--
-- LA CAUSE, ET ELLE EST DANS L'INTERFACE, PAS DANS LES DROITS
-- 0018 a fait de `valider` un BOUTON : le trigger repose la case à
-- `false` dans la même écriture. Conséquence à l'écran : on coche, on
-- enregistre, la grille se rafraîchit... et la case est décochée, comme
-- avant le clic. Le seul retour visible que reçoit l'administrateur est
-- donc l'image exacte d'un échec. `status` a bien changé, deux colonnes
-- plus loin, hors du champ de vision sur une table qui en compte douze.
--
-- Une commande qui efface la preuve de son propre effet n'est pas une
-- commande utilisable : la personne recommence, doute, puis conclut que
-- le mécanisme est cassé. C'est ce qui s'est passé.
--
-- LA CORRECTION : la case cesse d'être un bouton et devient un MIROIR.
--   `valider` cochée  ⇔  `status = 'approved'`
-- Cocher valide et la case RESTE cochée. Décocher remet la boutique en
-- attente (elle quitte la vitrine) — un geste sans motif à fournir,
-- contrairement au refus, qui reste une écriture explicite de `status`
-- + `rejection_reason`.
--
-- POURQUOI CE N'EST PAS LA « DEUXIÈME SOURCE DE VÉRITÉ » QUE 0012
-- REFUSAIT : `status` reste seul lu par l'application et par toutes les
-- policies. `valider` n'est qu'un affichage de `status`, recalculé à
-- CHAQUE écriture par le trigger ci-dessous — les deux colonnes ne
-- peuvent donc pas diverger, même si quelqu'un écrit directement l'une
-- ou l'autre en SQL.
--
-- UN SEUL TRIGGER, ET C'EST LE POINT TECHNIQUE À RETENIR
-- 0018 a dû dupliquer les effets de `touch_merchant_approval` parce que
-- `before update OF status` ne se réveille QUE si la commande mentionne
-- `status`. Deux triggers partiels sur la même décision, c'est deux
-- occasions de diverger : le suivant qui ajoutera une transition devra
-- penser aux deux. On les remplace par un seul trigger sans liste de
-- colonnes, qui voit donc toutes les écritures.


-- --- 1. La règle d'arbitrage, écrite une fois ------------------------
-- Qui commande quand les deux colonnes bougent dans la même écriture ?
-- `status`. Choisir un statut dans une liste est un geste délibéré ;
-- la case, elle, est un raccourci. Le raccourci ne l'emporte jamais sur
-- l'ordre explicite.
--
-- `security invoker` (le défaut, écrit pour que ce soit un choix) : ce
-- trigger ne lit aucune autre table, il n'a donc besoin d'aucun droit
-- emprunté. Il n'écrit `new.valider` que dans NEW, en mémoire, avant
-- l'écriture — les privilèges de colonne de la partie 4 de 0002 portent
-- sur les colonnes CITÉES par la commande, pas sur ce qu'un trigger
-- ajuste ensuite. Un commerçant ne gagne donc rien ici, et le test 24
-- le vérifie.
create or replace function public.sync_merchant_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Une boutique naît en 'pending' (0001). Si une insertion pose quand
    -- même 'approved', la date de validation doit partir avec elle.
    if new.status = 'approved' then
      new.approved_at := now();
    end if;
    new.valider := (new.status = 'approved');
    return new;
  end if;

  -- La case a bougé et `status` non : c'est elle qui commande.
  -- Décocher renvoie en attente, jamais vers un refus : un refus doit
  -- dire pourquoi (contrainte `merchants_rejection_needs_reason`), et
  -- une case à cocher ne peut pas porter un motif.
  if new.valider is distinct from old.valider
     and new.status is not distinct from old.status then
    new.status := case when new.valider then 'approved' else 'pending' end;
  end if;

  -- Date de validation posée à la TRANSITION vers `approved`, pas à
  -- chaque écriture : sans le test sur l'ancien statut, une simple
  -- correction de nom repousserait la date de validation à aujourd'hui.
  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_at := now();
  end if;

  -- En sortant de `rejected`, le motif part avec. Il décrivait un refus
  -- qui n'a plus cours ; le garder, c'est risquer de le réafficher au
  -- prochain refus comme s'il venait d'être écrit.
  if new.status <> 'rejected' and old.status = 'rejected' then
    new.rejection_reason := null;
  end if;

  -- `approved_at` n'est JAMAIS effacé quand une boutique quitte
  -- `approved` : « cette boutique a été validée le 12 septembre » reste
  -- vrai même après un refus. Une date d'événement passé n'est pas un
  -- état courant.

  -- Le dernier mot, dans tous les cas : la case reflète `status`. C'est
  -- cette ligne, et elle seule, qui interdit aux deux colonnes de se
  -- contredire — y compris quand l'écriture ne touchait ni l'une ni
  -- l'autre.
  new.valider := (new.status = 'approved');
  return new;
end;
$$;


-- --- 2. Un seul trigger remplace les deux ----------------------------
-- Sans `of status` ni `of valider` : ce trigger doit voir TOUTES les
-- écritures, sinon la case peut survivre à un changement de statut fait
-- par un autre chemin (`resubmit_my_merchant` de 0015, par exemple).
drop trigger if exists merchants_apply_approval_switch on public.merchants;
drop trigger if exists merchants_touch_approval        on public.merchants;

create trigger merchants_sync_approval
  before insert or update on public.merchants
  for each row execute function public.sync_merchant_approval();

-- Les deux fonctions remplacées s'en vont avec leurs triggers : une
-- fonction orpheline finit par être rebranchée par erreur.
drop function if exists public.apply_approval_switch();
drop function if exists public.touch_merchant_approval();


-- --- 3. Les lignes existantes se réalignent --------------------------
-- La colonne valait `false` partout, y compris sur une boutique déjà
-- validée : sans ce rattrapage, l'administrateur verrait une case vide
-- en face d'une boutique approuvée, et la cocherait pour rien.
update public.merchants
   set valider = (status = 'approved')
 where valider is distinct from (status = 'approved');


-- --- 4. Ce que la colonne raconte d'elle-même ------------------------
comment on column public.merchants.valider is
  'Miroir de `status` pour l''éditeur de table : cochée = boutique validée. Cocher valide, décocher remet en attente (la boutique quitte la vitrine). Un refus ne passe PAS par ici : il s''écrit sur `status` avec son motif. Jamais lue par l''application, jamais accessible à un commerçant — la vérité reste dans `status`.';

-- Redondant avec la liste blanche de 0002 (`revoke update on merchants`
-- puis `grant` colonne par colonne, qui ne cite pas `valider`), et
-- réécrit quand même : une protection qui ne tient que par effet de
-- bord se perd au premier refactoring.
revoke update (valider) on public.merchants from authenticated, anon;
