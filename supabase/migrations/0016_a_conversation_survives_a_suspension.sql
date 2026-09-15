-- Une conversation survit à la suspension de la boutique,
-- et personne ne se contacte soi-même
--
-- Trouvé le 2026-09-15 par l'audit du parcours « visiteur → produit →
-- contacter le vendeur », les deux défauts vérifiés sur un PostgreSQL
-- local avant d'être corrigés.
--
-- ---------------------------------------------------------------------
-- DÉFAUT 1 — la conversation devient un 404 pour le client
-- ---------------------------------------------------------------------
-- 0013 a retiré de la vitrine la boutique dont le propriétaire est
-- suspendu, et c'était juste. Mais « retirée de la vitrine » y voulait
-- dire « la ligne `merchants` n'existe plus pour personne, sauf pour
-- elle-même » — y compris pour un client qui lui avait DÉJÀ écrit.
--
-- Conséquence mesurée : `getThreadContext` lit la conversation avec sa
-- boutique jointe (`merchants(...)`), la jointure revient vide, la
-- fonction renvoie `null` et `/messages/[id]` affiche « page
-- introuvable ». La liste `/messages`, elle, affiche toujours la ligne,
-- mais avec un nom d'interlocuteur VIDE. Le client perd donc l'accès à
-- son propre historique, sans qu'aucun écran ne lui dise pourquoi.
--
-- Suspendre un vendeur doit couper ce qu'il peut FAIRE, pas effacer ce
-- que ses clients ont déjà vécu. La règle existait d'ailleurs déjà dans
-- l'autre sens : « profiles: je vois mes interlocuteurs » laisse un
-- commerçant lire le nom du client avec qui il discute, suspendu ou non.
-- Il manquait simplement la branche symétrique côté boutique.
--
-- Ce que cette branche accepte de révéler : le NOM d'une boutique à
-- quelqu'un qui lui a déjà parlé — c'est-à-dire strictement rien de
-- neuf. Elle ne dit toujours pas POURQUOI la boutique a quitté la
-- vitrine : `merchant_is_public` reste le seul juge du catalogue, et la
-- distinction refusée / en attente / suspendue reste indivulguée.

create or replace function public.i_talk_with_merchant(mid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.merchant_id = mid
      and c.client_id = public.my_profile_id('client')
  );
$$;

comment on function public.i_talk_with_merchant(uuid) is
  'Ai-je déjà une conversation avec cette boutique ? Ne révèle que ce que l''appelant sait déjà : ses propres fils.';

-- `security definer` plutôt qu'un `exists` écrit directement dans la
-- policy : une sous-requête ordinaire sur `conversations` y ferait jouer
-- le RLS de `conversations`, qui interroge à son tour `merchants` — on
-- s'enfermerait dans une dépendance croisée dont la seule vertu serait
-- d'être difficile à relire. La fonction, elle, ne peut répondre que sur
-- MES fils : `my_profile_id('client')` est verrouillé sur `auth.uid()`.
drop policy if exists "merchants: boutiques approuvees publiques" on public.merchants;
create policy "merchants: boutiques approuvees publiques"
  on public.merchants for select
  using (
    public.merchant_is_public(id)
    or profile_id = public.my_profile_id('merchant')
    or public.i_talk_with_merchant(id)
  );


-- ---------------------------------------------------------------------
-- DÉFAUT 2 — on pouvait contacter sa propre boutique
-- ---------------------------------------------------------------------
-- Une personne qui possède les deux comptes liés (décision 8) ouvre la
-- fiche d'un de SES produits : le bouton « Contacter le vendeur » s'y
-- affiche comme pour n'importe quel visiteur. Vérifié en local : la
-- conversation est créée, le message part, et le fil se retrouve avec le
-- même être humain des deux côtés.
--
-- Le vrai dégât n'est pas le fil absurde, c'est le classement :
-- `bump_contact_count` (0002, 3.3) compte les CLIENTS DISTINCTS ayant
-- écrit sur un produit, et le tri « populaires » s'appuie dessus. Un
-- commerçant pouvait donc faire monter chacun de ses produits d'un cran
-- en s'écrivant à lui-même — exactement le bruit que le compteur avait
-- été conçu pour ne pas récompenser.
--
-- Le refus est posé ici, dans la base, et non seulement à l'écran : le
-- bouton peut être caché, l'adresse `/produit/xxx/contacter` reste
-- tapable à la main. L'écran cache quand même le bouton, pour que le
-- refus ne se présente jamais comme une panne.
drop policy if exists "conversations: un client contacte un commercant" on public.conversations;
create policy "conversations: un client contacte un commercant"
  on public.conversations for insert
  with check (
    client_id = public.my_profile_id('client')
    and public.is_active_profile(client_id)
    and public.merchant_is_public(merchant_id)
    -- « un client contacte UN COMMERÇANT » : quelqu'un d'autre. Écrit
    -- avec `is null or` plutôt qu'un `<>` seul — en SQL, `x <> null`
    -- vaut NULL, pas `true`, et la policy refuserait alors TOUS les
    -- clients qui n'ont pas de boutique, c'est-à-dire l'immense
    -- majorité d'entre eux.
    and (public.my_merchant_id() is null or merchant_id <> public.my_merchant_id())
  );
