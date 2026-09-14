-- Le temps réel de la messagerie
--
-- POURQUOI
-- Le fil de discussion ne se rechargeait qu'à la navigation : un message
-- reçu pendant qu'on lit le fil n'apparaissait qu'au prochain aller-retour
-- (retour à /messages puis rouvrir le fil). Assumé comme non bloquant pour
-- le lancement (docs/REPRISE.md, point 9 des points non bloquants), mais
-- resté à faire.
--
-- CE QUE FAIT CETTE MIGRATION, ET RIEN DE PLUS
-- Elle ajoute `messages` à la publication que le service Realtime de
-- Supabase diffuse aux navigateurs abonnés. Elle ne touche à AUCUNE règle
-- de sécurité : Realtime respecte le RLS de la table pour décider qui reçoit
-- quoi, donc les policies de `0002_rules_and_security.sql` — un participant
-- ne voit que les messages de SES fils — s'appliquent déjà sans rien
-- ajouter ici. Rien à rejouer dans `security_test.sql`.
--
-- LA PUBLICATION EST CRÉÉE SI ELLE N'EXISTE PAS ENCORE
-- Un projet Supabase réel porte déjà `supabase_realtime` par défaut ;
-- `supabase/tests/_supabase_stub.sql`, qui simule cet environnement pour
-- rejouer les migrations sur un PostgreSQL nu, ne la porte pas. Sans ce
-- garde, la migration casserait la propriété vérifiée dans
-- `supabase/tests/README.md` — les 13 (bientôt 14) migrations rejouent
-- depuis une base vierge.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.messages;
