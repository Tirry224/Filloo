-- Valider une boutique d'un seul clic, depuis l'éditeur de table
--
-- Demande du porteur du projet, 2026-09-16 : valider une boutique « en
-- une touche » dans Supabase, sans écrire de SQL à chaque fois.
--
-- POURQUOI UNE CASE À COCHER, ET PAS LA COLONNE `status`
-- `status` est un type énuméré : dans la grille de Supabase, le modifier
-- demande d'ouvrir une liste, de choisir une valeur, puis d'enregistrer.
-- Une colonne booléenne, elle, est une case qu'on coche — un seul clic,
-- sur la bonne ligne, le nom de la boutique juste à côté. C'est la seule
-- différence : le geste. La décision, elle, reste entière.
--
-- CE QUE CETTE COLONNE N'EST PAS
-- Elle n'est PAS une deuxième source de vérité sur l'état d'une
-- boutique. `status` reste seul à dire si une boutique est validée ; la
-- case se décoche d'elle-même dans la même écriture, et repart donc
-- toujours de `false`. Elle n'est ni lue ni écrite par l'application :
-- c'est un bouton d'administration posé sur une table, rien de plus.
--
-- Ce détour est assumé pour une raison précise : le projet a décidé
-- (décision 11 de docs/SPEC.md) qu'il n'y aurait AUCUNE page
-- d'administration en v1. L'éditeur de table EST le tableau de bord, et
-- il mérite donc le même soin qu'un écran.
--
-- LE PIÈGE, ET IL EST SÉRIEUX
-- Un bouton « valider » accordé en écriture à un commerçant, c'est
-- l'auto-validation — la toute première faille qu'ont trouvée les tests
-- de ce projet (voir la partie 4 de 0002). La colonne reste donc HORS de
-- la liste blanche des colonnes modifiables. Le `revoke` ci-dessous est
-- redondant (une colonne neuve n'est accordée à personne quand l'UPDATE
-- a été révoqué au niveau de la table), et il est écrit quand même :
-- une protection qui dépend d'un effet de bord se perd au premier
-- refactoring. Un test le prouve plutôt que de l'affirmer.

alter table public.merchants
  add column valider boolean not null default false;

comment on column public.merchants.valider is
  'Bouton d''administration : cocher valide la boutique, puis la case se décoche seule. Jamais lue par l''application, jamais accessible à un commerçant. La vérité reste dans `status`.';


-- Ce que fait le clic, exactement — et rien de plus.
--
-- Les trois effets reprennent à l'identique ceux de
-- `touch_merchant_approval` (0012), et ce n'est pas une duplication par
-- négligence : ce trigger-là est déclaré `before update OF status`, donc
-- PostgreSQL ne le réveille que si la commande mentionne `status`.
-- Cocher une case ne le réveille pas. Vérifié sur un PostgreSQL local
-- avant d'écrire ces lignes : sans elles, la boutique passait bien à
-- 'approved' mais `approved_at` restait vide — une validation sans date,
-- c'est-à-dire une validation dont on ne peut plus dire quand elle a eu
-- lieu.
create or replace function public.apply_approval_switch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Seul le passage de décoché à coché agit. Décocher ne dévalide rien :
  -- retirer une boutique du catalogue est un autre geste, qui se fait
  -- sur `status` et demande un motif quand c'est un refus.
  if new.valider and not old.valider then
    if old.status <> 'approved' then
      new.approved_at := now();
    end if;
    if old.status = 'rejected' then
      new.rejection_reason := null;
    end if;
    new.status := 'approved';
  end if;

  -- La case repart toujours de `false`, cochée ou non : elle est un
  -- bouton, pas un état. Sans cette ligne, la grille afficherait une
  -- coche permanente qui ressemblerait à « cette boutique est validée »
  -- — une deuxième source de vérité, et la porte ouverte à ce que les
  -- deux se contredisent un jour.
  new.valider := false;
  return new;
end;
$$;

create trigger merchants_apply_approval_switch
  before update of valider on public.merchants
  for each row execute function public.apply_approval_switch();


-- La colonne reste interdite d'écriture à tout le monde sauf à
-- l'administrateur (`service_role` et le propriétaire de la table, qui
-- ignorent l'un comme l'autre ces privilèges).
revoke update (valider) on public.merchants from authenticated, anon;
