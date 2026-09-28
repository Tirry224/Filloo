-- =====================================================================
-- 0032 — Un blocage ferme le fil dans les deux sens, et se lève
-- =====================================================================
-- Constat du 2026-09-28 : un client avait bloqué la boutique SowShop et
-- continuait à lui écrire ; la boutique lisait ses messages sans pouvoir
-- répondre. `0002` (6.7) laissait écrire le BLOQUEUR — un blocage devenait
-- un canal à sens unique, l'inverse de ce qu'on attend d'un blocage.
--
-- Décision du porteur du projet, même jour :
--   1. un fil bloqué n'accepte plus AUCUN message, d'un côté comme de
--      l'autre ;
--   2. celui qui a bloqué peut débloquer — et lui seul. Le blocage n'est
--      plus définitif (décision de v1 abandonnée).
--
-- Trou fermé au passage : la policy de 0002 (6.6 bis) ne regardait pas
-- l'ANCIENNE valeur de `blocked_by`. La personne bloquée pouvait donc s'y
-- désigner à son tour (« contre-blocage ») et, sous l'ancienne règle
-- d'envoi, retrouver le droit d'écrire. La condition vit désormais dans
-- `using`, qui lit la ligne AVANT modification : seul un fil libre ou
-- bloqué par moi m'est modifiable.

-- ---------------------------------------------------------------------
-- 1. Bloquer ou débloquer
-- ---------------------------------------------------------------------
-- `using` (ligne avant) : je participe, et le fil est libre ou bloqué
-- par MOI. `with check` (ligne après) : je me désigne moi-même, ou je
-- rends le fil libre. Deux branches (client / commerçant) pour la même
-- raison qu'en 0002 : une connexion avec ses deux comptes liés ne doit
-- pas pouvoir désigner son AUTRE profil, non participant à ce fil.
drop policy if exists "conversations: je bloque mon interlocuteur" on public.conversations;
create policy "conversations: je bloque ou débloque mon interlocuteur"
  on public.conversations for update
  using (
    (client_id = public.my_profile_id('client')
     and (blocked_by is null or blocked_by = client_id))
    or
    (merchant_id = public.my_merchant_id()
     and (blocked_by is null
          or blocked_by = (select profile_id from public.merchants where id = merchant_id)))
  )
  with check (
    (client_id = public.my_profile_id('client')
     and (blocked_by is null or blocked_by = client_id))
    or
    (merchant_id = public.my_merchant_id()
     and (blocked_by is null
          or blocked_by = (select profile_id from public.merchants where id = merchant_id)))
  );

-- ---------------------------------------------------------------------
-- 2. L'envoi : réécrite en entier depuis 0017, seule la ligne du
--    blocage change (`blocked_by is null`, sans exception pour le
--    bloqueur).
-- ---------------------------------------------------------------------
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
        and c.blocked_by is null
    )
    and public.conversation_is_open(conversation_id)
  );
