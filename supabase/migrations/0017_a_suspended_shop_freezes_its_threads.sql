-- Une boutique suspendue met ses fils en LECTURE SEULE
--
-- Décision du porteur du projet, 2026-09-15, après l'audit du parcours
-- « contacter le vendeur » :
--
--   - les conversations existantes restent lisibles ;
--   - le client ne peut plus y envoyer de nouveau message ;
--   - le commerçant suspendu ne peut pas répondre non plus ;
--   - l'historique est conservé, rien n'est supprimé.
--
-- CE QUI MANQUAIT
-- 0013 a fermé la porte d'ENTRÉE : on n'ouvre plus un fil avec une
-- boutique dont le propriétaire est suspendu. Mais un fil DÉJÀ ouvert
-- restait grand ouvert côté client : « messages: envoi par les
-- participants » ne vérifie que l'expéditeur (`is_active_profile`),
-- jamais son destinataire. Vérifié en local avant correction : le
-- message du client partait, et la réponse du commerçant, elle, était
-- refusée. Le client attendait donc une réponse que la base rendait
-- impossible — exactement ce que 0013 avait refusé pour un premier
-- contact, laissé intact pour tous les suivants.
--
-- POURQUOI PAS `merchant_is_public`
-- Elle exige `status = 'approved'` EN PLUS d'un propriétaire actif. S'en
-- servir ici gèlerait aussi les fils d'une boutique simplement renvoyée
-- à la vérification (0015 : refusée → corrigée → 'pending'), qui n'a
-- commis aucune faute et dont les clients attendent une réponse. La
-- décision porte sur la SUSPENSION, pas sur la file d'attente de
-- validation : la fonction ci-dessous ne regarde donc que l'état du
-- compte.
--
-- POURQUOI PARAMÉTRÉE PAR CONVERSATION, ET PAS PAR BOUTIQUE
-- Une fonction `merchant_is_active(mid)` serait appelable en RPC sur
-- n'importe quelle boutique : croisée avec le catalogue public, elle
-- permettrait de distinguer « suspendue » de « refusée ou en attente »,
-- c'est-à-dire de lire une sanction. C'est précisément ce que 0013
-- s'était interdit. Un identifiant de CONVERSATION, lui, n'est connu que
-- de ses deux participants — qui ont déjà le droit de savoir que ce fil
-- ne prend plus d'écriture, puisque l'écran doit le leur dire.

create or replace function public.conversation_is_open(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.conversations c
      join public.merchants m on m.id = c.merchant_id
      join public.profiles  p on p.id = m.profile_id
     where c.id = cid
       and p.is_suspended = false
       and p.is_deleted   = false
  );
$$;

comment on function public.conversation_is_open(uuid) is
  'Ce fil accepte-t-il encore des messages ? Faux dès que la boutique en face a un compte suspendu ou supprimé. Ne dit rien du statut de validation de la boutique.';

-- Même précaution que `resubmit_my_merchant` (0015) : Supabase accorde
-- `execute` à `public` — donc à `anon` — sur toute fonction nouvelle. Un
-- visiteur non connecté n'écrit jamais de message ; il n'a donc aucune
-- raison de pouvoir poser la question.
revoke execute on function public.conversation_is_open(uuid) from public, anon;
grant  execute on function public.conversation_is_open(uuid) to authenticated;

-- La policy d'envoi, inchangée sauf sa dernière ligne. Elle est réécrite
-- en entier plutôt que complétée : une policy se lit d'un bloc, et
-- deviner ce qu'une version antérieure contenait est le meilleur moyen
-- de rouvrir un trou en croyant le boucher.
drop policy if exists "messages: envoi par les participants" on public.messages;
create policy "messages: envoi par les participants"
  on public.messages for insert
  with check (
    public.owns_profile(sender_id)
    and public.is_active_profile(sender_id)
    and exists (
      select 1 from public.conversations c
      where c.id = public.messages.conversation_id
        and (
          c.client_id = sender_id
          or exists (select 1 from public.merchants m where m.id = c.merchant_id and m.profile_id = sender_id)
        )
        and (c.blocked_by is null or c.blocked_by = sender_id)
    )
    -- Écrire à quelqu'un qui ne peut pas répondre n'est pas un service
    -- rendu — la phrase est de 0013, elle vaut aussi pour le deuxième
    -- message. Le fil reste LISIBLE : `messages: lecture par les
    -- participants` et `conversations: reservees aux participants` ne
    -- bougent pas, et 0016 garde la boutique visible dans le fil.
    and public.conversation_is_open(conversation_id)
  );
