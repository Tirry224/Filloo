-- =====================================================================
-- 0015 — Une boutique refusée peut être renvoyée à la vérification
-- =====================================================================
-- Le parcours décrit par l'écran 21 (docs/ECRANS.md, « Boutique refusée :
-- motif + correction possible ») est :
--
--     rejected → correction des informations → renvoi → pending →
--     validation par l'administrateur → approved
--
-- La troisième flèche n'existait pas. `/vendeur/refusee` proposait bien
-- « Corriger ma boutique », et la correction s'enregistrait — mais
-- `merchants.status` restait à 'rejected' pour toujours :
-- `0002_rules_and_security.sql` ne ré-accorde PAS `status` au commerçant
-- (liste blanche de colonnes : `shop_name`, `description`,
-- `whatsapp_phone`, `city_id`, `address_hint`), et c'est une bonne règle
-- qui ne bouge pas — un commerçant qui écrit son propre statut peut
-- s'auto-valider, la toute première faille trouvée par les tests.
--
-- Le commerçant refusé se retrouvait donc dans un cul-de-sac : il
-- corrigeait, revenait sur l'écran de refus, recorrigeait, et rien ne
-- repartait jamais vers l'administrateur. La demande de la spécification
-- (« correction possible ») était à moitié tenue.
--
-- Ce qui manquait n'est pas un droit d'écriture sur `status`, c'est UNE
-- transition précise : 'rejected' → 'pending', sur SA boutique, et rien
-- d'autre.


-- --- Une seule transition, sur sa propre boutique ---------------------
-- `security definer` — contrairement à `approve_merchant` / `reject_merchant`
-- de 0012, qui sont volontairement `invoker`. La différence n'est pas un
-- relâchement, c'est le contraire : ces deux-là s'adressent à
-- l'ADMINISTRATEUR et prennent le nom d'une boutique QUELCONQUE en
-- paramètre — en `definer`, n'importe qui aurait approuvé n'importe quelle
-- boutique. Celle-ci ne prend AUCUN paramètre : elle ne peut agir que sur
-- la boutique de la connexion qui l'appelle, résolue ici par
-- `my_profile_id('merchant')` depuis `auth.uid()`. Il n'y a rien à
-- désigner, donc rien à détourner.
--
-- Les trois garde-fous, dans l'ordre où ils s'appliquent :
--   1. `where profile_id = public.my_profile_id('merchant')` — ma boutique,
--      jamais celle d'un autre ; la fonction renvoie NULL pour une
--      connexion sans profil commerçant, et `where profile_id = null` ne
--      touche aucune ligne.
--   2. `and status = 'rejected'` — la SEULE transition autorisée. Une
--      boutique en attente, approuvée, ou déjà renvoyée n'est pas touchée.
--   3. `set status = 'pending'` est écrit en dur : 'approved' n'est
--      atteignable par aucun chemin d'ici, donc aucune auto-validation.
--
-- Le trigger `merchants_touch_approval` (0012) fait le reste : en quittant
-- 'rejected', le motif de refus s'efface tout seul. Il décrivait un refus
-- qui n'a plus cours.
--
-- `is_active_profile` en plus : un compte commerçant suspendu ne renvoie
-- pas sa boutique à la vérification. C'est la même condition que la policy
-- « merchants: je modifie ma boutique », qui filtrerait de toute façon ses
-- corrections — cette fonction ne doit pas être la porte dérobée d'une
-- règle appliquée partout ailleurs.
create or replace function public.resubmit_my_merchant()
returns public.merchants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.merchants;
  v_profile uuid := public.my_profile_id('merchant');
begin
  if v_profile is null or not public.is_active_profile(v_profile) then
    raise exception 'Votre compte commerçant ne permet pas cette action.';
  end if;

  update public.merchants
     set status = 'pending'
   where profile_id = v_profile
     and status = 'rejected'
  returning * into v_row;

  -- Rien renvoyé : la boutique n'est pas (ou plus) refusée. Le dire plutôt
  -- que répondre un succès vide — une action dont on ne peut pas savoir si
  -- elle a réussi est une action cassée, même quand elle fonctionne.
  if not found then
    raise exception 'Cette boutique n''est pas en attente de correction.';
  end if;
  return v_row;
end;
$$;

-- Supabase accorde `execute` à `public` sur toute fonction nouvelle, et
-- `public` inclut `anon`. Un visiteur non connecté n'obtiendrait rien
-- (`my_profile_id` renvoie NULL, l'exception part), mais une porte fermée
-- vaut mieux qu'une porte ouverte sur un mur : seule une connexion
-- authentifiée peut l'appeler.
revoke execute on function public.resubmit_my_merchant() from public, anon;
grant  execute on function public.resubmit_my_merchant() to authenticated;
