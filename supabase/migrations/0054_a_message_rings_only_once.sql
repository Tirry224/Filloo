-- =====================================================================
-- 0054 — Un message ne fait sonner son destinataire qu'une fois
-- =====================================================================
-- `/api/app/message-envoye` et `/api/app/message-equipe` peuvent être
-- rappelés en boucle pendant 2 minutes pour le même message : chaque
-- appel faisait sonner le téléphone. Le site posera ici une clé par
-- envoi (`message:<uuid>`, `equipe:<uuid>`) avant de notifier, par
-- `insert … on conflict do nothing` : seul l'appel qui crée la clé
-- envoie la notification.
--
-- Table du SERVEUR seul : RLS activé SANS politique, tout révoqué pour
-- `anon` et `authenticated` ; `service_role` y lit, écrit et efface.
--
-- Ménage : une clé ne sert que pendant la fenêtre de rappel (2 min).
-- Purge DANS la base par pg_cron, comme 0028 et 0053, des clés de plus
-- d'un jour.

create table public.notifications_envoyees (
  cle        text primary key,
  created_at timestamptz not null default now()
);

comment on table public.notifications_envoyees is
  'Une ligne par notification déjà envoyée (message:<uuid>, equipe:<uuid>). Écrit et lu par service_role seul ; purgé après un jour (pg_cron).';

alter table public.notifications_envoyees enable row level security;

revoke all on table public.notifications_envoyees from public, anon, authenticated;
grant select, insert, delete on table public.notifications_envoyees to service_role;

create or replace function public.purger_notifications_envoyees()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  with parties as (
    delete from public.notifications_envoyees
     where created_at < now() - interval '1 day'
    returning 1
  )
  select count(*) from parties;
$$;

revoke all on function public.purger_notifications_envoyees() from public, anon, authenticated;
grant execute on function public.purger_notifications_envoyees() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purger-notifications-envoyees', '43 3 * * *',
                          'select public.purger_notifications_envoyees()');
  end if;
end $$;
