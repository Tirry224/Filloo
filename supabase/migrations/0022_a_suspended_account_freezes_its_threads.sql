-- Un compte suspendu gèle ses fils DANS LES DEUX SENS
--
-- Décision du porteur du projet, 2026-09-17, en réponse au point 15 de
-- docs/REPRISE.md : on ne communique pas avec un compte suspendu, quel
-- que soit le côté du fil où il se trouve.
--
-- CE QUE 0017 AVAIT FERMÉ, ET CE QU'IL AVAIT LAISSÉ OUVERT
-- 0017 a gelé les fils d'une BOUTIQUE suspendue : le client n'y écrit
-- plus, le commerçant suspendu non plus. Le cas miroir est resté ouvert
-- et a été mesuré le lendemain : un CLIENT suspendu ne peut plus écrire
-- (`is_active_profile(sender_id)` s'en charge depuis 0002), mais le
-- commerçant, lui, pouvait toujours lui répondre — dans le vide, puisque
-- l'autre ne pourra pas réagir.
--
-- C'est exactement le défaut que 0017 a fermé, pris par l'autre bout, et
-- la phrase de 0013 vaut identiquement ici : écrire à quelqu'un qui ne
-- peut pas répondre n'est pas un service rendu. Le commerçant y perdrait
-- même quelque chose — il attendrait une réponse qui ne viendra pas, et
-- conclurait que son client l'ignore.
--
-- CE QUI NE CHANGE PAS
-- La lecture. Le fil reste entièrement consultable des deux côtés, comme
-- depuis le 2026-09-15 : lecture seule, jamais suppression. Les policies
-- de lecture ne sont pas touchées, et 0016 garde la boutique visible
-- dans le fil.
--
-- POURQUOI LA MÊME FONCTION, RÉÉCRITE EN ENTIER
-- Une policy et une fonction se lisent d'un bloc. Compléter celle de
-- 0017 par un `and` ajouté à la fin obligerait à retrouver l'autre
-- moitié de la règle dans une migration antérieure pour savoir ce
-- qu'elle dit vraiment — et c'est ainsi qu'on rouvre un trou en croyant
-- le boucher. La policy d'envoi, elle, n'a PAS besoin d'être retouchée :
-- elle appelle déjà `conversation_is_open`, qui porte toute la règle.

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
      join public.merchants m  on m.id = c.merchant_id
      join public.profiles  pm on pm.id = m.profile_id      -- le côté boutique
      join public.profiles  pc on pc.id = c.client_id       -- le côté client
     where c.id = cid
       -- Les deux côtés du fil, et personne d'autre. Cette condition est
       -- celle de 0017, et elle n'est pas décorative : sans elle, un
       -- troisième compte à qui le RLS refuse tout obtenait quand même
       -- une réponse en appelant la fonction avec un identifiant de
       -- conversation — `security definer` rouvrait par la petite porte
       -- ce que trois policies fermaient par la grande.
       and (c.client_id = public.my_profile_id('client')
            or c.merchant_id = public.my_merchant_id())
       -- Et MAINTENANT les deux côtés doivent être actifs, pas
       -- seulement celui de la boutique.
       and pm.is_suspended = false and pm.is_deleted = false
       and pc.is_suspended = false and pc.is_deleted = false
  );
$$;

comment on function public.conversation_is_open(uuid) is
  'Ce fil accepte-t-il encore MES messages ? Faux si je n''y participe pas, ou si l''un des deux comptes — le mien compris — est suspendu ou supprimé. Ne dit rien du statut de validation de la boutique, ni ne distingue ces cas.';

-- Les droits sont reposés parce que `create or replace` ne les perd pas,
-- mais qu'une fonction recréée un jour par un `drop` les perdrait : la
-- même précaution redondante qu'en 0017, pour la même raison qu'en 0018
-- — une protection qui dépend d'un effet de bord se perd au premier
-- refactoring.
revoke execute on function public.conversation_is_open(uuid) from public, anon;
grant  execute on function public.conversation_is_open(uuid) to authenticated;
