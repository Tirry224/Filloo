-- =====================================================================
-- 0043 : un membre de l'équipe ne voit que l'espace de l'équipe
-- =====================================================================
-- Décision du porteur du projet du 2026-11-05 : les comptes de l'équipe
-- n'ont ni espace client ni espace boutique, seulement `/admin` — comme
-- le compte `OWNER_EMAIL` depuis le 2026-10-07.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Être dans `equipe` MARQUE la connexion : `app_metadata.equipe = true`
--    dans `auth.users`. Sortir de `equipe` retire la marque. Le site la
--    lit sans requête de plus (`getUser()` la rend déjà) et renvoie ce
--    compte vers `/admin` sur toute autre page.
-- 2. La marque ne se fabrique pas : `app_metadata` n'est écrit que par le
--    serveur (Supabase interdit à un utilisateur de le modifier), et
--    `equipe` n'a aucune policy d'écriture (0042).
-- 3. Une annonce ne part plus vers les membres de l'équipe : ils n'ont
--    plus d'espace où la lire.
--
-- `equipe` reste la SEULE source de vérité : la marque en est une copie
-- tenue par trigger, jamais écrite à la main.

create or replace function public.equipe_marquer_la_connexion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"equipe": true}'::jsonb
     where id = new.auth_user_id;
  elsif tg_op = 'DELETE' then
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'equipe'
     where id = old.auth_user_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.equipe_marquer_la_connexion() from public, anon, authenticated;

create trigger equipe_marquer_la_connexion
  after insert or delete on public.equipe
  for each row execute function public.equipe_marquer_la_connexion();

-- Les membres déjà inscrits (0042).
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"equipe": true}'::jsonb
 where exists (select 1 from public.equipe e where e.auth_user_id = u.id);


-- Les annonces ne partent plus vers l'équipe (même fonction que 0042,
-- une condition de plus).
create or replace function public.annonce_fixer_destinataires()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.annonce_destinataires (annonce_id, auth_user_id)
  select distinct new.id, p.auth_user_id
    from public.profiles p
   where p.is_deleted = false
     and not exists (select 1 from public.equipe e where e.auth_user_id = p.auth_user_id)
     and (
       new.public = 'tous'
       or (new.public = 'clients' and p.role = 'client')
       or (new.public = 'commercants' and p.role = 'merchant')
     );
  return null;
end;
$$;
