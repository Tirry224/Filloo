-- =====================================================================
-- 0062 : un contact qui suit un clic sur une pub compte pour cette pub
-- =====================================================================
-- Décision du porteur du projet du 2026-11-07 : un contact compte pour
-- une campagne s'il arrive dans les 5 jours APRÈS un clic sur cette pub,
-- depuis le même navigateur (`analytics_events.visiteur_id`, 0057).
-- Branche `monetisation` : NE S'APPLIQUE PAS avant que le porteur du
-- projet publie cette branche, et s'applique APRÈS 0057 et 0058-0061.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `resultats_campagnes()` (0047, lue par /vendeur/publicite et
--    /admin/publicite) rend, EN FIN de colonnes, `contacts` : le nombre
--    de navigateurs distincts qui, après un `pub_clic` de la campagne,
--    ont ouvert un contact (`contact_ouvert`, `whatsapp_ouvert`,
--    `message_envoye`) vers la boutique de la campagne, au plus 5 jours
--    après ce clic (borne incluse), jamais avant ni au même instant.
-- 2. Une mesure sans `visiteur_id` (d'avant 0057, ou de l'app mobile) ne
--    compte ni comme clic attribuable ni comme contact.
-- 3. Un message envoyé par le commerçant (`actor_role = 'merchant'`) ne
--    compte pas : c'est sa réponse, pas un contact venu de la pub.
-- 4. `campagne_id`, `vues`, `clics`, la sécurité (`security definer`,
--    chacun ses campagnes, l'équipe toutes) et les droits (authenticated
--    seul) sont ceux de 0047, inchangés.
--
-- CHOIX
-- - La fenêtre est UNE constante, en tête de la requête (`reglage`) :
--   la changer = une nouvelle migration qui ne touche que cette ligne.
-- - Navigateurs DISTINCTS : deux contacts du même navigateur pour la même
--   campagne = 1. Le même navigateur peut compter pour deux campagnes de
--   la même boutique s'il a cliqué sur les deux (chaque pub a mené à lui).
-- - `drop` puis `create` : une colonne de sortie en plus change le type
--   rendu, ce que `create or replace` refuse. Aucune vue ni policy ne
--   dépend de la fonction (constaté dans les fichiers 0047-0061). Le
--   tout tient dans la transaction de la migration : aucun appel ne voit
--   la fonction absente.
-- - Pas d'index nouveau : les clics se lisent par
--   `analytics_events_par_campagne_idx` (0047, `campagne_id, name`), les
--   contacts par `analytics_events_par_boutique_idx` (0059,
--   `merchant_id, occurred_at`). Au volume constaté (5 boutiques, 0
--   campagne en production au 2026-11-07), rien de plus ne se justifie.
--
-- COMPATIBILITÉ : l'app mobile n'appelle pas `resultats_campagnes`
-- (constaté le 2026-11-07, grep dans /home/user/Filloo-mobile/src). Le
-- site lit `campagne_id`, `vues`, `clics` par leur nom : une colonne en
-- plus ne le casse pas. `database.types.ts` gagne `contacts: number`.
-- À SAVOIR côté site : `message_envoye` n'est compté avec `merchantId`
-- que si `src/lib/actions/messages.ts` le passe (pas le cas au
-- 2026-11-07) ; sans lui, ces messages ne comptent pour aucune pub.

drop function public.resultats_campagnes();

create function public.resultats_campagnes()
returns table (campagne_id uuid, vues bigint, clics bigint, contacts bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with reglage as (
    -- La fenêtre d'attribution (décision du 2026-11-07).
    select interval '5 days' as fenetre
  )
  select c.id,
         count(e.id) filter (where e.name = 'pub_vue'),
         count(e.id) filter (where e.name = 'pub_clic'),
         (select count(distinct k.visiteur_id)
            from public.analytics_events k, reglage r
           where k.merchant_id = c.merchant_id
             and k.name in ('contact_ouvert', 'whatsapp_ouvert', 'message_envoye')
             and k.visiteur_id is not null
             and k.actor_role is distinct from 'merchant'
             and exists (
               select 1
                 from public.analytics_events cl
                where cl.campagne_id = c.id
                  and cl.name = 'pub_clic'
                  and cl.visiteur_id = k.visiteur_id
                  and k.occurred_at >  cl.occurred_at
                  and k.occurred_at <= cl.occurred_at + r.fenetre
             ))
    from public.campagnes c
    left join public.analytics_events e on e.campagne_id = c.id
   where c.merchant_id = (select public.my_merchant_id())
      or (select public.je_suis_de_l_equipe())
   group by c.id;
$$;

comment on function public.resultats_campagnes() is
  'Résultats de chaque campagne visible par l''appelant (la sienne, ou toutes pour l''équipe) : affichages, clics, et contacts = navigateurs distincts ayant contacté la boutique dans les 5 jours après un clic sur la pub (0062).';

revoke execute on function public.resultats_campagnes() from public, anon;
grant execute on function public.resultats_campagnes() to authenticated;
