-- =====================================================================
-- 0070 : un mot de bienvenue plus chaleureux pour les nouvelles boutiques
-- =====================================================================
-- Décision du porteur du projet (2026-11-09) : le texte de 0056 était
-- trop cru. Le nouveau souhaite la bienvenue et donne le bon conseil pour
-- avoir plus de clients (des photos fidèles), sans menace et sans parler
-- de litiges ni de signalements.
--
-- CE QUI CHANGE : seulement le texte du message. Le déclencheur
-- `merchants_recoit_la_bienvenue` de 0056 est gardé tel quel ; il appelle
-- la fonction remplacée ici. Même fil, mêmes droits, même garantie
-- « jamais bloquant ». Les boutiques déjà créées gardent l'ancien message.

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
      'Bienvenue sur Filloo, ' || new.shop_name || ' ! Nous sommes ravis de vous compter parmi nous : votre boutique est prête.' || E'\n'
      || 'Notre conseil pour attirer plus de clients : publiez vos propres photos, prises avec une bonne lumière, qui montrent vos produits tels qu''ils sont. Les clients achètent plus volontiers quand ils voient le vrai produit, et ils reviennent quand ce qu''ils reçoivent ressemble à la photo.' || E'\n'
      || 'Une question ? Répondez-nous ici, nous sommes là pour vous aider.' || E'\n'
      || '— L''équipe Filloo'
    );
  exception when others then
    raise warning 'Bienvenue non envoyee a la boutique % : % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

revoke execute on function public.boutique_creee_recoit_la_bienvenue() from public, anon, authenticated;
