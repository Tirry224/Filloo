-- Une boutique suspendue quitte la vitrine
--
-- Trouvé le 2026-09-13 par un audit du parcours client, vérifié policy
-- par policy avant d'être corrigé.
--
-- LE PROBLÈME
-- La suspension d'un compte vit sur `profiles.is_suspended`. La
-- visibilité d'une boutique vit sur `merchants.status`. RIEN ne reliait
-- les deux. Un commerçant suspendu pour abus gardait donc :
--   - sa fiche boutique publique  (« merchants: boutiques approuvees
--     publiques » ne regarde que `status = 'approved'`) ;
--   - tous ses produits au catalogue (« products: catalogue public »,
--     même oubli) ;
--   - son bouton « Contacter le vendeur » actif (« conversations: un
--     client contacte un commercant », même oubli).
--
-- Le pire n'est pas qu'il reste visible : c'est qu'un client pouvait lui
-- ÉCRIRE. Le message partait, et le commerçant ne pouvait jamais
-- répondre — « messages: j'ecris dans mes fils » exige, elle,
-- `is_active_profile`. Le client attendait une réponse qui ne pouvait pas
-- venir, sans que rien ne le lui dise. La décision 13 de docs/SPEC.md
-- (« abus : signaler + suspension ») perdait tout effet côté vitrine.
--
-- POURQUOI UNE NOUVELLE FONCTION, ET PAS `is_active_profile`
-- `is_active_profile(pid)` porte, depuis la correction de 0005, un
-- `auth_user_id = auth.uid()` à l'intérieur : elle ne répond QUE pour un
-- profil m'appartenant. C'était le correctif d'une vraie fuite — elle
-- révélait auparavant si un profil ARBITRAIRE était suspendu. L'employer
-- ici renverrait donc faux pour tout le monde et viderait le catalogue
-- entier. Une fonction qui protège une donnée ne peut pas servir à la
-- publier : il en faut une seconde, qui répond à une autre question.
--
-- CE QUE `merchant_is_public` ACCEPTE DE RÉVÉLER
-- Exactement une chose : « cette boutique est-elle listée ? ». C'est
-- déjà déductible en interrogeant le catalogue, donc la rendre
-- appelable en RPC n'ouvre rien de neuf. Elle ne dit PAS pourquoi une
-- boutique est absente — refusée, en attente, ou suspendue se
-- confondent volontairement dans un seul `false`. C'est la différence
-- entre publier un fait public et divulguer une sanction.
--
-- `security definer` est donc un choix assumé, écrit en clair : il est
-- indispensable puisque la policy de `profiles` masque les lignes
-- d'autrui, et une sous-requête ordinaire ne verrait rien.

create or replace function public.merchant_is_public(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchants m
    join public.profiles p on p.id = m.profile_id
    where m.id = mid
      and m.status = 'approved'
      and p.is_suspended = false
      and p.is_deleted = false
  );
$$;

comment on function public.merchant_is_public(uuid) is
  'Cette boutique est-elle listée publiquement ? Approuvée ET propriétaire actif. Ne dit jamais laquelle des trois conditions manque.';

-- 1. La fiche boutique
drop policy if exists "merchants: boutiques approuvees publiques" on public.merchants;
create policy "merchants: boutiques approuvees publiques"
  on public.merchants for select
  using (
    public.merchant_is_public(id)
    -- La mienne reste visible pour moi, suspendu ou non : sans cette
    -- branche, un commerçant suspendu ne pourrait plus voir sa propre
    -- boutique pour comprendre ce qui lui arrive.
    or profile_id = public.my_profile_id('merchant')
  );

-- 2. Le catalogue
drop policy if exists "products: catalogue public" on public.products;
create policy "products: catalogue public"
  on public.products for select
  using (
    -- `sold` reste public avec `active` : c'est la décision de 0008, un
    -- produit vendu s'affiche grisé plutôt que de disparaître.
    (status in ('active', 'sold') and public.merchant_is_public(merchant_id))
    or merchant_id = public.my_merchant_id()
  );

-- 3. Le premier contact
drop policy if exists "conversations: un client contacte un commercant" on public.conversations;
create policy "conversations: un client contacte un commercant"
  on public.conversations for insert
  with check (
    client_id = public.my_profile_id('client')
    and public.is_active_profile(client_id)
    -- Écrire à quelqu'un qui ne peut pas répondre n'est pas un service
    -- rendu. Le refus est ici plutôt qu'à l'écran parce que le client
    -- n'a PAS le droit de lire l'état d'un profil tiers : l'application
    -- seule ne pourrait pas le savoir.
    and public.merchant_is_public(merchant_id)
  );
