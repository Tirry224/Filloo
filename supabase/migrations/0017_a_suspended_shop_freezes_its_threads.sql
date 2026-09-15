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
-- s'était interdit.
--
-- POURQUOI ELLE VÉRIFIE AUSSI QUI DEMANDE
-- Première version de cette fonction : elle ne regardait que l'état de
-- la boutique, en tenant pour acquis qu'un identifiant de conversation
-- n'est connu que de ses deux participants. Vérification du
-- 2026-09-15, faite AVANT de l'appliquer : un troisième compte, à qui
-- le RLS refuse la conversation, ses messages et jusqu'à la boutique,
-- obtenait quand même `true` en appelant la fonction avec cet
-- identifiant. Autrement dit, `security definer` rouvrait par la petite
-- porte ce que trois policies fermaient par la grande.
--
-- Que l'identifiant soit difficile à deviner n'est pas une protection,
-- c'est une probabilité : il circule dans les URL, les journaux, les
-- liens partagés, les captures d'écran. C'est la leçon que 0005 avait
-- déjà tirée sur `is_active_profile`, qui répondait de la même façon sur
-- un profil quelconque.
--
-- La fonction exige donc en plus que l'appelant soit DANS ce fil. Pour
-- tous les autres elle répond `false`, exactement comme pour un fil
-- gelé : on ne peut donc pas distinguer « fermé » de « pas le mien »,
-- et il n'y a rien à apprendre en la sondant. La policy d'envoi, elle,
-- n'y perd rien — celui qui écrit est toujours un participant.

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
       -- Les deux côtés du fil, et personne d'autre.
       and (c.client_id = public.my_profile_id('client')
            or c.merchant_id = public.my_merchant_id())
       and p.is_suspended = false
       and p.is_deleted   = false
  );
$$;

comment on function public.conversation_is_open(uuid) is
  'Ce fil accepte-t-il encore MES messages ? Faux si je n''y participe pas, ou si la boutique en face a un compte suspendu ou supprimé. Ne dit rien du statut de validation de la boutique, ni ne distingue ces deux cas.';

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
