-- =====================================================================
-- 0056 : une boutique créée reçoit un mot de bienvenue de l'équipe
-- =====================================================================
-- Décision du porteur du projet (2026-11-07) : à la création d'une
-- boutique, l'équipe lui écrit un message de bienvenue qui insiste sur des
-- photos fidèles (moins de déçus, de litiges, de signalements).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Chaque INSERT dans `merchants` dépose UN message dans le fil
--    « boutique » (`espace = 'merchant'`, 0044) du commerçant avec
--    l'équipe (`fil_equipe`, 0042) : `de_l_equipe = true`, `auteur_id`
--    null (aucun collègue ne l'a écrit), non lu, heure du serveur (le
--    déclencheur `fil_equipe_heure_du_serveur` de 0042 s'applique).
-- 2. Une modification de la boutique n'en dépose aucun (AFTER INSERT
--    seulement).
-- 3. Jamais bloquant : si le message ne peut pas s'écrire, la boutique se
--    crée quand même (bloc d'exception, WARNING dans les journaux).
--
-- CHOIX
-- - Un déclencheur dans la base plutôt que le site : la boutique se crée
--   aussi depuis l'app installée (`creerBoutique`, insert direct), qui ne
--   change pas.
-- - `security definer` : le commerçant n'a pas le droit d'écrire un
--   message « de l'équipe » (policies de 0042/0044) ; le propriétaire de
--   la table, si. Les policies d'insertion ne sont donc pas élargies.
-- - Aucun message aux boutiques déjà créées : non demandé.
--
-- COMPATIBILITÉ : un déclencheur et sa fonction, rien d'autre. L'app
-- installée insère dans `merchants` sans `.select()` et ne voit rien de
-- plus ; celle qui lit le fil de l'équipe (dépôt filloo-mobile, branche
-- `dev`) le reçoit comme une réponse de l'équipe.

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
    values (
      v_auth,
      'merchant',
      null,
      true,
      'Bienvenue sur Filloo, ' || new.shop_name || ' ! Votre boutique est prête.' || E'\n'
      || 'Un conseil important : publiez des photos qui montrent vraiment vos produits — vos propres photos, avec une bonne lumière. Un client qui reçoit un article différent de la photo sera déçu, et cela peut entraîner des litiges et des signalements contre votre boutique.' || E'\n'
      || 'Des photos fidèles, ce sont des clients satisfaits qui reviennent. Une question ? Répondez-nous ici.' || E'\n'
      || '— L''équipe Filloo'
    );
  exception when others then
    raise warning 'Bienvenue non envoyee a la boutique % : % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

revoke execute on function public.boutique_creee_recoit_la_bienvenue() from public, anon, authenticated;

create trigger merchants_recoit_la_bienvenue
  after insert on public.merchants
  for each row execute function public.boutique_creee_recoit_la_bienvenue();
