create or replace function public.sync_merchant_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'approved' then
      new.approved_at := now();
    end if;
    new.valider := (new.status = 'approved');
    return new;
  end if;

  -- La case a bougé et `status` non : c'est elle qui commande.
  if new.valider is distinct from old.valider
     and new.status is not distinct from old.status then
    new.status := case when new.valider then 'approved' else 'pending' end;
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_at := now();
  end if;

  if new.status <> 'rejected' and old.status = 'rejected' then
    new.rejection_reason := null;
  end if;

  -- Le dernier mot : la case reflète `status`.
  new.valider := (new.status = 'approved');
  return new;
end;
$$;

drop trigger if exists merchants_apply_approval_switch on public.merchants;
drop trigger if exists merchants_touch_approval        on public.merchants;

create trigger merchants_sync_approval
  before insert or update on public.merchants
  for each row execute function public.sync_merchant_approval();

drop function if exists public.apply_approval_switch();
drop function if exists public.touch_merchant_approval();

update public.merchants
   set valider = (status = 'approved')
 where valider is distinct from (status = 'approved');

comment on column public.merchants.valider is
  'Miroir de `status` pour l''éditeur de table : cochée = boutique validée. Cocher valide, décocher remet en attente (la boutique quitte la vitrine). Un refus ne passe PAS par ici : il s''écrit sur `status` avec son motif. Jamais lue par l''application, jamais accessible à un commerçant — la vérité reste dans `status`.';

revoke update (valider) on public.merchants from authenticated, anon;
