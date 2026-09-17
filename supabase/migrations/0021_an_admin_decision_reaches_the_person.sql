-- =====================================================================
-- 0021 : une décision d'administration atteint la personne concernée
-- =====================================================================
-- Trois décisions se prennent aujourd'hui dans l'éditeur de table
-- Supabase, et AUCUNE n'est annoncée : une boutique validée, une
-- boutique refusée, un compte suspendu. La personne l'apprend en
-- rouvrant l'application d'elle-même — c'est-à-dire, pour un commerçant
-- qui attend depuis 48 heures, souvent jamais.
--
-- POURQUOI LA BASE, ALORS QUE `src/lib/notifications.ts` ARGUMENTE LE
-- CONTRAIRE
-- Cet argument-là reste juste pour son cas : un message est envoyé par
-- une action serveur Next.js, donc `after()` suffit et rien n'a besoin
-- de vivre en base. Ici, l'événement naît AILLEURS — une case cochée
-- dans un navigateur sur supabase.com. Aucune ligne de l'application ne
-- s'exécute à ce moment-là. La base est le seul témoin possible, donc
-- c'est elle qui note ce qu'il y a à dire.
--
-- POURQUOI UNE FILE D'ATTENTE, ET PAS UN APPEL DIRECT (`pg_net`)
-- Un webhook n'a qu'une seule chance : s'il tombe pendant un
-- déploiement, la boutique est validée et personne ne l'apprendra
-- JAMAIS, sans que rien ne le signale. Une ligne qui reste ici, elle, se
-- voit en une requête — et le balayage suivant la reprend tout seul.
-- C'est la règle du projet (« une action dont on ne peut pas savoir si
-- elle a réussi est une action cassée ») appliquée à un envoi que
-- personne ne regarde. En prime : pas d'extension à activer, pas de clé
-- d'API stockée en base.
--
-- POURQUOI UNE TABLE PLUTÔT QU'UNE COLONNE « déjà prévenu »
-- Les trois décisions se REJOUENT : une boutique refusée peut être
-- renvoyée (0015) puis refusée de nouveau, un compte suspendu peut être
-- rétabli puis suspendu encore. Une colonne-date devrait être remise à
-- zéro à chaque fois, sur deux tables différentes, et un oubli se
-- traduirait par un silence. Une ligne par événement n'a rien à
-- remettre à zéro.

create type public.notification_kind as enum (
  'merchant_approved',
  'merchant_rejected',
  'profile_suspended'
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       public.notification_kind not null,
  -- La personne à prévenir, jamais son adresse : l'email vit dans
  -- `auth.users` et ne se recopie pas ici. Une file d'attente qui porte
  -- des adresses devient une liste de diffusion à protéger ; celle-ci ne
  -- porte que des identifiants déjà présents partout ailleurs.
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Posé quand la notification n'a plus rien à attendre : soit l'email
  -- est parti, soit le destinataire est définitivement injoignable
  -- (compte supprimé). `last_error` dit laquelle des deux.
  sent_at    timestamptz,
  -- Sans ce compteur, une adresse invalide serait réessayée toutes les
  -- dix minutes pour toujours — et Resend nous le facturerait en
  -- réputation d'envoi. Le balayage s'arrête au-delà d'un seuil ; la
  -- ligne reste visible, non envoyée, avec son motif.
  attempts   int not null default 0,
  last_error text
);

-- L'index ne couvre QUE ce que le balayage lit : les lignes en attente.
-- Un index complet grossirait avec l'historique des envois réussis, que
-- personne n'interroge jamais.
create index notifications_waiting_idx
  on public.notifications (created_at)
  where sent_at is null;

comment on table public.notifications is
  'File d''attente des décisions d''administration à annoncer par email. Écrite par les triggers ci-dessous, vidée par /api/notifications (Vercel Cron). Jamais lue ni écrite par un utilisateur.';


-- ---------------------------------------------------------------------
-- Ce que les triggers guettent
-- ---------------------------------------------------------------------
-- `after update` TOUT COURT, et surtout PAS `after update of status` :
-- c'est le piège documenté dans 0018. `UPDATE OF status` désigne les
-- colonnes CITÉES PAR LA COMMANDE, pas celles qu'un autre trigger a
-- modifiées en chemin. Or la validation se fait en cochant `valider`,
-- et c'est `sync_merchant_approval` (0019), déclenché AVANT, qui pose
-- `status`. Une commande qui ne mentionne que `valider` n'aurait donc
-- réveillé personne : la boutique passait à 'approved' et la file
-- restait vide. Le filtrage se fait dans le corps, où `new.status` porte
-- déjà sa valeur définitive.

create or replace function public.queue_merchant_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.notifications (kind, profile_id)
    values ('merchant_approved', new.profile_id);
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into public.notifications (kind, profile_id)
    values ('merchant_rejected', new.profile_id);
  end if;
  return null;
end;
$$;

create trigger merchants_queue_decision
  after update on public.merchants
  for each row execute function public.queue_merchant_decision();

-- Un renvoi de boutique (0015 : 'rejected' → 'pending') ne remplit donc
-- rien : ce n'est pas une décision, c'est une demande. Seul le verdict
-- se notifie.

create or replace function public.queue_profile_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un compte supprimé est déjà banni côté `auth.users` : le suspendre
  -- au passage ne mérite pas un email vers une boîte que personne ne
  -- relèvera plus.
  if new.is_suspended and not old.is_suspended and not new.is_deleted then
    insert into public.notifications (kind, profile_id)
    values ('profile_suspended', new.id);
  end if;
  return null;
end;
$$;

create trigger profiles_queue_suspension
  after update on public.profiles
  for each row execute function public.queue_profile_suspension();

-- Le rétablissement n'est pas notifié, et c'est un choix : il se
-- constate en se reconnectant, et un email « votre compte fonctionne de
-- nouveau » n'apprend rien à quelqu'un qui n'avait peut-être pas
-- remarqué la coupure.


-- ---------------------------------------------------------------------
-- Personne n'a affaire à cette table
-- ---------------------------------------------------------------------
-- Elle n'est lue que par `service_role`, depuis la route de balayage.
-- RLS activée SANS aucune policy suffit déjà à tout refuser, mais le
-- `revoke` est écrit quand même : c'est la leçon de 0002 partie 4 et de
-- 0018 — une protection qui dépend d'un effet de bord se perd au premier
-- refactoring, et un test doit pouvoir la prouver.

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
