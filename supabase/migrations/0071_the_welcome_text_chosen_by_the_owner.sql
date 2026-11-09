-- =====================================================================
-- 0071 : le mot de bienvenue écrit par le porteur du projet
-- =====================================================================
-- Décision du porteur du projet (2026-11-09) : il a écrit lui-même le
-- texte. Il remplace celui de 0070, mot pour mot, à une exception : ses
-- puces « * » deviennent « • », car le fil affiche le texte brut
-- (`whitespace-pre-wrap`, pas de Markdown) et l'étoile se verrait.
--
-- CE QUI CHANGE : seulement le texte. Le déclencheur de 0056 est gardé ;
-- mêmes droits, même garantie « jamais bloquant ». Le nom de la boutique
-- n'apparaît plus : le texte choisi ne le contient pas.

create or replace function public.boutique_creee_recoit_la_bienvenue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid;
begin
  begin
    select p.auth_user_id into v_auth
      from public.profiles p
     where p.id = new.profile_id;

    if v_auth is null then
      raise warning 'Bienvenue non envoyee : profil % sans connexion.', new.profile_id;
      return null;
    end if;

    insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
    values (v_auth, 'merchant', null, true, public.texte_de_bienvenue_boutique());
  exception when others then
    raise warning 'Bienvenue non envoyee a la boutique % : % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

-- Le texte vit dans sa propre fonction : le test le compare sans le
-- recopier, et un prochain changement de texte ne touche qu'elle.
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
      || E'Filloo vous permet de créer votre boutique en ligne, de présenter vos produits et de les faire découvrir à de nouveaux clients.\n'
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

revoke execute on function public.boutique_creee_recoit_la_bienvenue() from public, anon, authenticated;
revoke execute on function public.texte_de_bienvenue_boutique() from public, anon, authenticated;
