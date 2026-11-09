-- =====================================================================
-- 0072 : la bienvenue ne dit plus « créer votre boutique »
-- =====================================================================
-- Décision du porteur du projet (2026-11-09) : le message arrive juste
-- APRÈS la création de la boutique ; « Filloo vous permet de créer votre
-- boutique » ne servait à rien. La phrase devient « Filloo vous permet de
-- présenter vos produits et de les faire découvrir à de nouveaux
-- clients. » Seule la fonction du texte (0071) change.

create or replace function public.texte_de_bienvenue_boutique()
returns text
language sql
immutable
set search_path = ''
as $$
  select E'🎉 Bienvenue sur Filloo !\n'
      || E'\n'
      || E'Nous sommes ravis de vous compter parmi les commerçants de notre plateforme.\n'
      || E'\n'
      || E'Filloo vous permet de présenter vos produits et de les faire découvrir à de nouveaux clients.\n'
      || E'\n'
      || E'💡 Quelques conseils pour attirer davantage de clients :\n'
      || E'\n'
      || E'• Publiez des photos nettes, lumineuses et de bonne qualité.\n'
      || E'• Choisissez des photos qui montrent clairement vos produits.\n'
      || E'• Ajoutez des prix et des descriptions précises.\n'
      || E'• Prenez le temps de bien présenter chaque article.\n'
      || E'• Publiez régulièrement de nouveaux produits pour faire vivre votre boutique.\n'
      || E'\n'
      || E'Un conseil important : une belle présentation donne envie aux clients de découvrir vos produits et de vous contacter.\n'
      || E'\n'
      || E'Notre objectif est de vous accompagner dans le développement de votre activité.\n'
      || E'\n'
      || E'Bienvenue dans la communauté Filloo !'
$$;

revoke execute on function public.texte_de_bienvenue_boutique() from public, anon, authenticated;
