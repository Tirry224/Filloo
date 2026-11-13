-- =====================================================================
-- 0078 — Un client garde ses produits favoris
-- =====================================================================
-- Demande du porteur du projet (2026-11-13) : le cœur de 0077 passe aussi
-- sur la fiche d'un produit (/produit/[id]), et la liste du compte client
-- (/compte/favoris) gagne un onglet Produits. Même modèle que 0077.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `favoris_produits` (client, produit), une ligne par couple (clé
--    primaire). Le site lit (jointure `products(...)`), ajoute
--    (`upsert … ignoreDuplicates` = `insert … on conflict do nothing`) et
--    retire avec la session de la personne.
-- 2. Lire et retirer : seulement MES lignes (`my_profile_id('client')`,
--    0041). Un client SUSPENDU lit et retire encore les siennes.
-- 3. Ajouter : mon profil client ACTIF (`is_active_profile`) ET un
--    produit PUBLIC (`produit_est_public`, ci-dessous) : statut `active`
--    ou `sold`, pas masqué par l'équipe, dans une boutique publique
--    (`merchant_is_public`, 0013). C'est exactement ce que le catalogue
--    montre à tous (policy « products: catalogue public », 0008/0013/0039)
--    — `sold` compris : la fiche d'un produit vendu reste publique (0008,
--    0020) et porte le cœur.
--    PAS à travers le RLS de `products` : sa lecture montre aussi au
--    commerçant SES brouillons et produits masqués (comptes liés : mon
--    profil client verrait, par ma boutique, mes propres brouillons).
-- 4. Aucune modification (ni policy ni droit `update`), `created_at`
--    daté par la base. Rien pour `anon`.
-- 5. Le commerçant ne voit PAS qui a mis ses produits en favori : aucune
--    policy côté boutique, aucun compteur.
-- 6. SUPPRESSION DE COMPTE (`is_deleted = true` par le site) : le
--    déclencheur `favoris_partent_avec_le_profil` (0077) efface aussi
--    - les favoris produits d'un profil CLIENT supprimé ;
--    - les favoris qui désignent un produit de la boutique d'un profil
--      COMMERÇANT supprimé.
--    Un produit seulement masqué, repassé en brouillon ou vendu GARDE ses
--    favoris : il sort de la liste du client par le RLS de `products` s'il
--    n'est plus lisible, et y revient s'il est republié. Un produit
--    supprimé emporte ses favoris (`on delete cascade`).
-- 7. ÉQUIPE (0076) : un favori produit n'est PAS une activité ; il part
--    avec le profil par la cascade. Commentaire de `profil_a_une_activite`
--    mis à jour ; sa logique ne change pas.
--
-- COMPATIBILITÉ : table et fonction neuves ; le déclencheur de 0077 est
-- remplacé (`create or replace`, mêmes droits), son comportement sur
-- `favoris` est inchangé. Le site de `main` ne lit pas la table.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La table
-- ---------------------------------------------------------------------
create table public.favoris_produits (
  client_id  uuid        not null references public.profiles(id) on delete cascade,
  product_id uuid        not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, product_id)
);

-- La clé primaire sert « mes favoris » ; celui-ci sert la cascade depuis
-- `products` et le déclencheur (point 6).
create index favoris_produits_product_id_idx on public.favoris_produits (product_id);

comment on table public.favoris_produits is
  'Produits favoris d''un client (0078). Lus, ajoutés, retirés par le client seul ; invisibles du commerçant ; effacés quand le profil client ou celui du commerçant est supprimé.';

alter table public.favoris_produits enable row level security;


-- ---------------------------------------------------------------------
-- 2. Les droits : au plus juste
-- ---------------------------------------------------------------------
revoke all on public.favoris_produits from public, anon, authenticated;
grant select, delete on public.favoris_produits to authenticated;
grant insert (client_id, product_id) on public.favoris_produits to authenticated;
grant select, insert, update, delete on public.favoris_produits to service_role;


-- ---------------------------------------------------------------------
-- 3. Un produit visible du public
-- ---------------------------------------------------------------------
-- Les filtres du catalogue public refaits à la main (comme
-- `merchant_is_public`) : `security definer` pour ne PAS passer par le RLS
-- de `products`. `masque_par_equipe` implique déjà `hidden` (trigger de
-- 0046) ; le filtre reste, au cas où ce trigger changerait.
create or replace function public.produit_est_public(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.products p
     where p.id = pid
       and p.status in ('active', 'sold')
       and not p.masque_par_equipe
       and public.merchant_is_public(p.merchant_id)
  );
$$;

comment on function public.produit_est_public(uuid) is
  'Aide du RLS (0078) : vrai si le produit est dans le catalogue public (active ou sold, non masqué par l''équipe, boutique publique), quel que soit l''appelant.';

revoke all on function public.produit_est_public(uuid) from public, anon, authenticated;
grant execute on function public.produit_est_public(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Les règles d'accès (client seul)
-- ---------------------------------------------------------------------
create policy "favoris_produits: je vois mes favoris"
  on public.favoris_produits for select
  to authenticated
  using (client_id = (select public.my_profile_id('client')));

create policy "favoris_produits: j''ajoute un produit visible a mes favoris"
  on public.favoris_produits for insert
  to authenticated
  with check (
    client_id = (select public.my_profile_id('client'))
    and (select public.is_active_profile(public.my_profile_id('client')))
    and public.produit_est_public(product_id)
  );

create policy "favoris_produits: je retire un produit de mes favoris"
  on public.favoris_produits for delete
  to authenticated
  using (client_id = (select public.my_profile_id('client')));


-- ---------------------------------------------------------------------
-- 5. Un profil supprimé emporte aussi les favoris produits
-- ---------------------------------------------------------------------
-- `create or replace` : garde le trigger de 0077 et ses droits (fermée à
-- public, anon, authenticated, 0069) ; le `revoke` est rejoué par sûreté.
create or replace function public.favoris_partent_avec_le_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.favoris f where f.client_id = new.id;

  delete from public.favoris f
   using public.merchants m
   where m.profile_id = new.id
     and f.merchant_id = m.id;

  delete from public.favoris_produits fp where fp.client_id = new.id;

  delete from public.favoris_produits fp
   using public.products p, public.merchants m
   where m.profile_id = new.id
     and p.merchant_id = m.id
     and fp.product_id = p.id;

  return null;
end;
$$;

comment on function public.favoris_partent_avec_le_profil() is
  'Trigger (0077, 0078) : un profil passé is_deleted = true perd ses favoris, boutiques et produits (client) ; la boutique qu''il tenait et ses produits sortent des favoris de tous (commerçant).';

revoke all on function public.favoris_partent_avec_le_profil() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. 0076 : un favori produit n'est pas une activité
-- ---------------------------------------------------------------------
comment on function public.profil_a_une_activite(uuid) is
  'Interne (0076) : vrai si supprimer ce profil détruirait une donnée réelle (boutique, conversation, blocage, message, signalement, journal). Les notifications et les favoris, boutiques (0077) et produits (0078), ne comptent pas : ils partent avec le profil par la cascade.';
