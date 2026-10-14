-- Chacun n'entend que ses propres messages
--
-- POURQUOI
-- Depuis 0014, le site et l'app écoutent la table `messages` entière en
-- `postgres_changes`. Pour CHAQUE message, Realtime vérifie le RLS de
-- `messages` pour CHAQUE personne connectée : le coût grandit comme le
-- produit (messages × connectés), donc en carré avec l'audience.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Chaque message envoyé est poussé, par la base elle-même, sur le canal
--    PRIVÉ de chacun des deux participants du fil, et d'eux seuls :
--    `user:<auth.uid()>`. Un fil marqué lu y est poussé UNE fois par fil,
--    quel que soit le nombre de messages que le marquage a touchés.
-- 2. Un compte connecté ne peut écouter que SON canal : la politique de
--    `realtime.messages` compare le sujet demandé à `auth.uid()`. Realtime
--    la vérifie une seule fois, quand le canal s'ouvre — plus à chaque
--    message.
-- 3. Personne n'émet sur ces canaux depuis un navigateur ou un téléphone :
--    aucune politique `insert` sur `realtime.messages` (le RLS refuse donc
--    tout), et la fonction de diffusion n'est exécutable par personne.
-- 4. Une diffusion qui échoue ne fait JAMAIS échouer l'envoi d'un message :
--    l'erreur devient un avertissement dans le journal. `realtime.send`
--    attrape déjà ses propres erreurs (constaté en production le
--    2026-10-14) ; on les attrape aussi, pour ne pas dépendre d'un détail
--    interne de Supabase qui peut changer.
--
-- CE QUE LES CLIENTS REÇOIVENT (événement `message`, ne pas changer sans
-- mettre à jour `src/lib/supabase/mes-messages.ts` et l'app installée) :
--   { "op": "INSERT" | "UPDATE", "id", "conversation_id", "sender_id",
--     "product_id", "body", "created_at", "read_at" }
-- Pour `UPDATE` (fil lu), seuls `op`, `conversation_id` et `read_at` (le
-- plus récent) sont remplis ; les autres champs valent null.
--
-- CE QUI NE CHANGE PAS, VOLONTAIREMENT
-- `messages` RESTE dans la publication `supabase_realtime` (0014) : les
-- versions de test de l'app déjà installées sur les téléphones écoutent
-- encore `postgres_changes` et ne se mettent pas à jour toutes seules
-- (voir `.claude/savoir/relecteur-compat.md`). La retirer se fera dans une
-- migration à part, quand plus aucune version installée ne s'en sert —
-- c'est seulement alors que le coût en carré disparaît vraiment.
--
-- DEUX DÉCLENCHEURS AU NIVEAU DE L'INSTRUCTION
-- Le marquage « lu » met à jour tous les messages non lus d'un fil d'un
-- seul coup : un déclencheur par ligne enverrait N diffusions identiques.
-- Au niveau de l'instruction, avec les tables de transition, on regroupe
-- par fil. Postgres refuse les tables de transition sur un déclencheur à
-- plusieurs événements ou à liste de colonnes : d'où deux déclencheurs, et
-- un filtre `read_at is distinct from` au lieu de `update of read_at`.
--
-- `security definer` : la fonction lit `profiles` et `merchants` au-delà
-- de ce que le RLS montre à l'expéditeur, et écrit dans
-- `realtime.messages`, où le RLS n'accorde aucune écriture. Elle n'est
-- appelable que par les déclencheurs : `execute` retiré à tous.

create or replace function public.diffuser_message_aux_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  envoi record;
begin
  if tg_op = 'INSERT' then
    for envoi in
      select destinataire.auth_user_id,
             jsonb_build_object(
               'op',              'INSERT',
               'id',              n.id,
               'conversation_id', n.conversation_id,
               'sender_id',       n.sender_id,
               'product_id',      n.product_id,
               'body',            n.body,
               'created_at',      n.created_at,
               'read_at',         n.read_at
             ) as payload
        from nouveaux n
        join public.conversations c on c.id = n.conversation_id
        cross join lateral (
          select pc.auth_user_id
            from public.profiles pc
           where pc.id = c.client_id
          union                       -- union, pas union all : dédoublonne
          select pm.auth_user_id
            from public.merchants m
            join public.profiles pm on pm.id = m.profile_id
           where m.id = c.merchant_id
        ) destinataire
    loop
      begin
        perform realtime.send(envoi.payload, 'message',
                              'user:' || envoi.auth_user_id::text, true);
      exception when others then
        raise warning 'diffusion du message % impossible : %',
          envoi.payload ->> 'id', sqlerrm;
      end;
    end loop;

  elsif tg_op = 'UPDATE' then
    for envoi in
      select destinataire.auth_user_id,
             jsonb_build_object(
               'op',              'UPDATE',
               'id',              null,
               'conversation_id', f.conversation_id,
               'sender_id',       null,
               'product_id',      null,
               'body',            null,
               'created_at',      null,
               'read_at',         f.read_at
             ) as payload
        from (
          select n.conversation_id, max(n.read_at) as read_at
            from nouveaux n
            join anciens a on a.id = n.id
           where n.read_at is distinct from a.read_at
           group by n.conversation_id
        ) f
        join public.conversations c on c.id = f.conversation_id
        cross join lateral (
          select pc.auth_user_id
            from public.profiles pc
           where pc.id = c.client_id
          union
          select pm.auth_user_id
            from public.merchants m
            join public.profiles pm on pm.id = m.profile_id
           where m.id = c.merchant_id
        ) destinataire
    loop
      begin
        perform realtime.send(envoi.payload, 'message',
                              'user:' || envoi.auth_user_id::text, true);
      exception when others then
        raise warning 'diffusion du fil % lu impossible : %',
          envoi.payload ->> 'conversation_id', sqlerrm;
      end;
    end loop;
  end if;

  return null;
end;
$$;

revoke execute on function public.diffuser_message_aux_participants() from public, anon, authenticated;

drop trigger if exists messages_diffuser_envoi on public.messages;
create trigger messages_diffuser_envoi
  after insert on public.messages
  referencing new table as nouveaux
  for each statement execute function public.diffuser_message_aux_participants();

drop trigger if exists messages_diffuser_lecture on public.messages;
create trigger messages_diffuser_lecture
  after update on public.messages
  referencing old table as anciens new table as nouveaux
  for each statement execute function public.diffuser_message_aux_participants();


-- Écouter : seulement son propre canal, seulement en broadcast.
-- `(select ...)` : évalué une fois par requête, pas une fois par ligne.
drop policy if exists "realtime: chacun n'écoute que son canal" on realtime.messages;
create policy "realtime: chacun n'écoute que son canal"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );
-- Aucune politique `insert` : les clients n'émettent pas.
