-- Valider une boutique d'un seul clic, depuis l'éditeur de table
--
-- Demande du porteur du projet, 2026-09-16 : valider une boutique « en
-- une touche » dans Supabase, sans écrire de SQL à chaque fois.
--
-- POURQUOI UNE CASE À COCHER, ET PAS LA COLONNE status
-- status est un type énuméré : dans la grille de Supabase, le modifier
-- demande d'ouvrir une liste, de choisir, puis d'enregistrer. Une
-- colonne booléenne est une case qu'on coche — un seul clic, sur la
-- bonne ligne, le nom de la boutique juste à côté. Seul le GESTE change.
--
-- CE QUE CETTE COLONNE N'EST PAS : une deuxième source de vérité.
-- status reste seul à dire si une boutique est validée ; la case se
-- décoche dans la même écriture et repart toujours de false. Elle n'est
-- ni lue ni écrite par l'application.
--
-- LE PIÈGE, ET IL EST SÉRIEUX : un bouton « valider » accordé en
-- écriture à un commerçant, c'est l'auto-validation — la toute première
-- faille trouvée par les tests de ce projet (partie 4 de 0002). La
-- colonne reste hors de la liste blanche, et le revoke ci-dessous est
-- écrit même s'il est redondant : une protection qui dépend d'un effet
-- de bord se perd au premier refactoring. Un test le prouve.

alter table public.merchants
  add column valider boolean not null default false;

comment on column public.merchants.valider is
  'Bouton d''administration : cocher valide la boutique, puis la case se décoche seule. Jamais lue par l''application, jamais accessible à un commerçant. La vérité reste dans `status`.';

-- Les trois effets reprennent ceux de touch_merchant_approval (0012), et
-- ce n'est pas une duplication par négligence : ce trigger-là est
-- déclaré `before update OF status`, donc PostgreSQL ne le réveille que
-- si la commande mentionne status. Cocher une case ne le réveille pas.
-- Mesuré sur un PostgreSQL local avant d'écrire ces lignes : sans elles,
-- la boutique passait bien à 'approved' mais approved_at restait vide —
-- une validation dont on ne peut plus dire quand elle a eu lieu.
create or replace function public.apply_approval_switch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Seul le passage de décoché à coché agit. Décocher ne dévalide rien :
  -- retirer une boutique du catalogue est un autre geste, qui se fait
  -- sur status et demande un motif quand c'est un refus.
  if new.valider and not old.valider then
    if old.status <> 'approved' then
      new.approved_at := now();
    end if;
    if old.status = 'rejected' then
      new.rejection_reason := null;
    end if;
    new.status := 'approved';
  end if;

  -- La case repart toujours de false : elle est un bouton, pas un état.
  new.valider := false;
  return new;
end;
$$;

create trigger merchants_apply_approval_switch
  before update of valider on public.merchants
  for each row execute function public.apply_approval_switch();

revoke update (valider) on public.merchants from authenticated, anon;
