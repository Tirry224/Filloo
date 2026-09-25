-- =====================================================================
-- 0027 — Un seul signalement EN ATTENTE par personne et par cible
-- =====================================================================
-- Constaté le 2026-09-25 : la même personne pouvait signaler dix fois
-- le même produit, et la file de modération recevait dix lignes pour une
-- seule plainte.
--
-- L'index est PARTIEL (`where handled_at is null`) : une fois le
-- signalement traité, la même personne peut signaler de nouveau la même
-- cible — un produit corrigé puis redevenu douteux doit pouvoir revenir
-- dans la file. Un index plein l'aurait interdit pour toujours.
--
-- Les doublons déjà en attente ne sont PAS supprimés : le plus ancien de
-- chaque groupe reste en attente, les suivants sont marqués traités.
-- Leur texte reste lisible dans le tableau de bord, et l'index peut se
-- créer.

update public.reports r
   set handled_at = now()
 where r.handled_at is null
   and exists (
     select 1
       from public.reports plus_ancien
      where plus_ancien.handled_at is null
        and plus_ancien.reporter_id = r.reporter_id
        and plus_ancien.target_type = r.target_type
        and plus_ancien.target_id   = r.target_id
        and (plus_ancien.created_at, plus_ancien.id) < (r.created_at, r.id)
   );

create unique index reports_un_seul_en_attente
  on public.reports (reporter_id, target_type, target_id)
  where handled_at is null;
