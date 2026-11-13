-- =====================================================================
-- 0077 — Un client garde ses boutiques favorites
-- =====================================================================
-- Demande du porteur du projet (2026-11-13) : un bouton cœur sur la fiche
-- d'une boutique (/boutique/[id]) et la liste dans le compte client
-- (/compte/favoris).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `favoris` (client, boutique), une ligne par couple (clé primaire).
--    Le site lit, ajoute (`upsert … ignoreDuplicates`, soit `insert … on
--    conflict do nothing`) et retire avec la session de la personne.
-- 2. Lire et retirer : seulement MES lignes (`client_id` = mon profil
--    client non supprimé, `my_profile_id`, 0041). Un client SUSPENDU lit
--    et retire encore les siennes (la suspension coupe l'écriture vers les
--    autres, jamais la lecture ; retirer ne touche personne, comme retirer
--    son téléphone, 0068).
-- 3. Ajouter : mon profil client ACTIF (`is_active_profile` : ni suspendu
--    ni supprimé) ET une boutique PUBLIQUE (`merchant_is_public`, 0013 :
--    approuvée, propriétaire ni suspendu ni supprimé) — la même règle que
--    « conversations: un client contacte un commercant ».
--    PAS `exists (select 1 from merchants …)` à travers le RLS : la policy
--    de lecture de `merchants` montre AUSSI ma propre boutique et toute
--    boutique avec qui j'ai un fil (`i_talk_with_merchant`, 0016), même
--    suspendue (constaté en production le 2026-11-13, `pg_policy`).
--    Ma propre boutique (comptes liés) reste ajoutable : aucun compteur
--    n'en dépend, contrairement au contact (0016, défaut 2).
-- 4. Aucune modification (ni policy ni droit `update`) : un favori
--    s'ajoute ou se retire. `created_at` n'est pas insérable : la base le
--    date. Rien pour `anon`.
-- 5. Le commerçant ne voit PAS qui l'a mis en favori : aucune policy côté
--    boutique, aucun compteur (demande du 2026-11-13).
-- 6. SUPPRESSION DE COMPTE (anonymisation, `src/lib/suppression-compte.ts`,
--    qui passe `is_deleted = true` en service_role) : le déclencheur
--    `favoris_partent_avec_le_profil` efface aussitôt
--    - les favoris d'un profil CLIENT supprimé ;
--    - les favoris qui désignent la boutique d'un profil COMMERÇANT
--      supprimé (elle ne revient jamais : recréer le compte crée une
--      autre boutique, 0041). Une boutique seulement SUSPENDUE garde ses
--      favoris : elle sort de la liste (RLS de `merchants`) et y revient
--      si elle rouvre.
--    Rien à changer dans le code du site : la base le fait, quel que soit
--    le chemin (site, équipe, tableau de bord). Un profil vraiment effacé
--    (`delete`, 0076) emporte ses favoris par `on delete cascade`, et une
--    boutique effacée aussi.
-- 7. ÉQUIPE (0076) : un favori n'est PAS une activité. Entrer dans
--    l'équipe efface les profils sans activité ; leurs favoris partent
--    avec eux par la cascade, comme leurs `notifications`. `0076` disait
--    « un profil sans activité n'emporte que ses notifications » : c'est
--    désormais « ses notifications et ses favoris ». Le commentaire de
--    `profil_a_une_activite` est mis à jour ici ; sa logique ne change pas.
--
-- COMPATIBILITÉ : table neuve, rien n'est renommé ni retiré. Le site de
-- `main` ne la lit pas. Les droits par défaut de `public` (tout à anon et
-- authenticated, constaté 2026-11-07) sont retirés puis rendus au plus
-- juste.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La table
-- ---------------------------------------------------------------------
create table public.favoris (
  client_id   uuid        not null references public.profiles(id)  on delete cascade,
  merchant_id uuid        not null references public.merchants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (client_id, merchant_id)
);

-- La clé primaire sert « mes favoris » (client_id en tête) ; celui-ci
-- sert la cascade depuis `merchants` et le déclencheur (point 6).
create index favoris_merchant_id_idx on public.favoris (merchant_id);

comment on table public.favoris is
  'Boutiques favorites d''un client (0077). Lues, ajoutées, retirées par le client seul ; invisibles du commerçant ; effacées quand le profil client ou celui du commerçant est supprimé.';

alter table public.favoris enable row level security;


-- ---------------------------------------------------------------------
-- 2. Les droits : au plus juste
-- ---------------------------------------------------------------------
revoke all on public.favoris from public, anon, authenticated;
grant select, delete on public.favoris to authenticated;
grant insert (client_id, merchant_id) on public.favoris to authenticated;
grant select, insert, update, delete on public.favoris to service_role;


-- ---------------------------------------------------------------------
-- 3. Les règles d'accès (client seul)
-- ---------------------------------------------------------------------
create policy "favoris: je vois mes favoris"
  on public.favoris for select
  to authenticated
  using (client_id = (select public.my_profile_id('client')));

create policy "favoris: j''ajoute une boutique visible a mes favoris"
  on public.favoris for insert
  to authenticated
  with check (
    client_id = (select public.my_profile_id('client'))
    and (select public.is_active_profile(public.my_profile_id('client')))
    and public.merchant_is_public(merchant_id)
  );

create policy "favoris: je retire une boutique de mes favoris"
  on public.favoris for delete
  to authenticated
  using (client_id = (select public.my_profile_id('client')));


-- ---------------------------------------------------------------------
-- 4. Un profil supprimé emporte les favoris
-- ---------------------------------------------------------------------
-- `security definer` : vaut quel que soit celui qui anonymise (le site
-- passe par service_role, qui contourne le RLS ; un autre chemin futur
-- n'aurait pas forcément le droit `delete`). Fonction de trigger : fermée
-- à tous (0069), le trigger s'exécute quand même.
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

  return null;
end;
$$;

comment on function public.favoris_partent_avec_le_profil() is
  'Trigger (0077) : un profil passé is_deleted = true perd ses favoris (client) et la boutique qu''il tenait sort des favoris de tous (commerçant).';

revoke all on function public.favoris_partent_avec_le_profil() from public, anon, authenticated;

-- `when (new.is_deleted)` et non « passe de faux à vrai » : une
-- suppression rejouée par le site (`supprimerProfil` est rejouable)
-- refait le ménage, sans coût.
create trigger favoris_partent_avec_le_profil
  after update of is_deleted on public.profiles
  for each row
  when (new.is_deleted)
  execute function public.favoris_partent_avec_le_profil();


-- ---------------------------------------------------------------------
-- 5. 0076 : un favori n'est pas une activité
-- ---------------------------------------------------------------------
comment on function public.profil_a_une_activite(uuid) is
  'Interne (0076) : vrai si supprimer ce profil détruirait une donnée réelle (boutique, conversation, blocage, message, signalement, journal). Les notifications et les favoris (0077) ne comptent pas : ils partent avec le profil par la cascade.';
