-- =====================================================================
-- 0073 : un compte créé par Google complète lui-même son profil
-- =====================================================================
-- Décision du porteur du projet (2026-11-09) : on peut créer son compte
-- avec Google (pas Facebook).
--
-- LE PROBLÈME : `handle_new_user` (0002) crée le profil à partir des
-- métadonnées envoyées par `signUpAction` (rôle, nom, téléphone). Google
-- n'envoie ni rôle ni téléphone : le profil naîtrait « client » avec un
-- téléphone vide — et un vendeur passé par Google se retrouverait client,
-- sans numéro WhatsApp pour sa boutique.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Une connexion créée par un fournisseur autre que l'email
--    (`raw_app_meta_data ->> 'provider'`, posé par Auth, pas par le
--    navigateur) ne reçoit AUCUN profil automatique.
-- 2. L'inscription par email ne change pas : même profil, mêmes
--    métadonnées. `provider` absent compte comme email (comptes créés
--    hors du flux normal, tests).
-- 3. Le premier profil d'une connexion Google est créé par la personne
--    elle-même, écran « Complétez votre compte », par la policy existante
--    « profiles: je cree mon second compte » (0068) : elle n'exige pas de
--    profil préexistant, refuse un compte suspendu, supprimé ou une
--    connexion fermée. Aucune policy n'est élargie.
--
-- Constaté en production le 2026-11-09 : les 12 connexions existantes ont
-- toutes `provider = 'email'`.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email' then
    return new;
  end if;

  insert into public.profiles (auth_user_id, role, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'client')::public.user_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Utilisateur'),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
