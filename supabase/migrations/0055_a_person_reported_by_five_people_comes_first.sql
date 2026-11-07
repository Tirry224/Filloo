-- =====================================================================
-- 0055 : une personne signalée par cinq personnes passe en tête
-- =====================================================================
-- Numérotée 0052 à l'écriture ; renommée 0055 le 2026-11-07 (collision avec
-- la 0052 de l'audit de sécurité). APPLIQUÉE en production sous la version
-- 20261107152647 : le « (0052) » du `comment on function` plus bas est le
-- texte réellement posé en base, il reste tel quel.
-- Décision du porteur du projet (2026-11-07) : quand une personne reçoit
-- des signalements de 5 personnes DIFFÉRENTES, son nom apparaît
-- au-dessus des autres dans /admin/moderation.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `comptes_tres_signales()` rend, à l'équipe seule, chaque compte visé
--    par au moins 5 signaleurs distincts parmi les signalements EN
--    ATTENTE (`handled_at is null`) : profil, nom (boutique si commerçant,
--    sinon `full_name`), rôle, nombre de signaleurs, dernier signalement ;
--    les plus signalés d'abord.
-- 2. La personne visée : produit → son commerçant ; boutique → son
--    commerçant ; conversation → l'AUTRE participant que le signaleur.
-- 3. Un signaleur compte une fois, quel que soit le nombre de ses
--    signalements : on compte des CONNEXIONS (`auth_user_id`), pas des
--    lignes ni des profils. Ainsi une personne qui signale depuis son
--    compte client puis depuis sa boutique, ou qui supprime et recrée son
--    compte (0041), ne compte qu'une fois.
-- 4. Un compte déjà suspendu (ce que montre `comptes_suspendus`, 0046) ou
--    supprimé n'y figure pas ; un signalement de soi-même ne compte pas
--    (la policy « reports: je signale » le laisse encore passer).
--
-- CHOIX
-- - Seuil en constante dans la fonction : le changer = une migration,
--   visible dans l'historique.
-- - Fonction de lecture seule, rien n'est écrit ni marqué : le classement
--   des signalements reste `traiter_signalement` (0046).
-- - Conversation dont le signaleur n'est aucun des deux participants (ne
--   devrait pas exister) : ignorée plutôt qu'attribuée au hasard.
--
-- COMPATIBILITÉ : une fonction NOUVELLE, rien d'autre. L'app installée
-- écrit dans `reports` sans rien lire de l'équipe : inchangée.

create or replace function public.comptes_tres_signales()
returns table (
  profile_id          uuid,
  nom                 text,
  role                text,
  signaleurs          bigint,
  dernier_signalement timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Décision du porteur du projet, 2026-11-07.
  c_seuil constant int := 5;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  -- Toutes les colonnes sont qualifiées : en plpgsql, `profile_id`,
  -- `role`… sont aussi des variables de sortie (piège noté en 0046).
  return query
  with vises as (
    select r.created_at,
           rp.auth_user_id as signaleur,
           case r.target_type
             when 'product'  then pm.profile_id
             when 'merchant' then tm.profile_id
             when 'conversation' then
               case
                 when rp.auth_user_id = cp.auth_user_id  then cm.profile_id
                 when rp.auth_user_id = cmp.auth_user_id then c.client_id
               end
           end as vise
      from public.reports r
      join public.profiles rp           on rp.id = r.reporter_id
      left join public.products pr      on r.target_type = 'product'      and pr.id = r.target_id
      left join public.merchants pm     on pm.id = pr.merchant_id
      left join public.merchants tm     on r.target_type = 'merchant'     and tm.id = r.target_id
      left join public.conversations c  on r.target_type = 'conversation' and c.id = r.target_id
      left join public.profiles cp      on cp.id = c.client_id
      left join public.merchants cm     on cm.id = c.merchant_id
      left join public.profiles cmp     on cmp.id = cm.profile_id
     where r.handled_at is null
  )
  select p.id,
         coalesce(m.shop_name, p.full_name),
         p.role::text,
         count(distinct v.signaleur),
         max(v.created_at)
    from vises v
    join public.profiles p        on p.id = v.vise
    left join public.merchants m  on m.profile_id = p.id
   where not p.is_suspended
     and not p.is_deleted
     and v.signaleur is distinct from p.auth_user_id
   group by p.id, m.shop_name, p.full_name, p.role
  having count(distinct v.signaleur) >= c_seuil
   order by count(distinct v.signaleur) desc, max(v.created_at) desc, p.id;
end;
$$;

comment on function public.comptes_tres_signales() is
  'Équipe seule : comptes visés par au moins 5 signaleurs distincts (signalements en attente), hors comptes suspendus ou supprimés (0052).';

revoke execute on function public.comptes_tres_signales() from public, anon;
grant execute on function public.comptes_tres_signales() to authenticated;
