-- =====================================================================
-- 0042 : l'équipe Filloo parle avec chaque personne inscrite
-- =====================================================================
-- Décision du porteur du projet du 2026-11-05 : l'équipe publie des
-- ANNONCES dans l'app, et chacun peut lui RÉPONDRE depuis l'app au lieu
-- d'écrire un email. Chaque membre de l'équipe a son propre compte ;
-- l'équipe lit et répond depuis `/admin` sur le site.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Seul le tableau de bord Supabase (`service_role`) fait entrer
--    quelqu'un dans l'équipe : aucune policy d'écriture sur `equipe`.
-- 2. Une annonce n'atteint que les personnes INSCRITES au moment où elle
--    est publiée, et du public visé : la liste des destinataires est
--    figée à la publication (`annonce_destinataires`). Quelqu'un qui
--    s'inscrit après ne la voit pas.
-- 3. Chacun ne voit que SES annonces et SON fil avec l'équipe ; l'équipe
--    voit tout. Aucune personne ne peut écrire au nom de l'équipe, ni
--    dans le fil d'un autre.
-- 4. Une personne suspendue garde la lecture mais n'écrit plus (même
--    règle que la messagerie, `0017`/`0022`).
-- 5. L'heure d'un message est celle du serveur : personne n'antidate.
--
-- CHOIX
-- - `auth_user_id`, pas `profile_id` : une connexion porte parfois deux
--   comptes (client et commerçant) ; c'est la même personne qui parle à
--   l'équipe, avec un seul fil. Même raisonnement qu'en `0035`.
-- - Une case « équipe » à part, pas une valeur de plus dans `user_role` :
--   un collaborateur peut aussi être client ou commerçant, et l'app
--   installée ne connaît que ces deux rôles.
-- - Pas de table « fil » : le fil d'une personne, ce sont ses lignes de
--   `fil_equipe`. Une table de plus ne porterait rien d'autre que son id.
-- - Pas de Realtime en v1 : l'app relit à l'ouverture et au toucher d'une
--   notification. À ajouter si le volume le justifie.

-- ---------------------------------------------------------------------
-- L'équipe
-- ---------------------------------------------------------------------
create table public.equipe (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  -- Le prénom affiché aux collègues dans `/admin` ; les utilisateurs, eux,
  -- ne voient que « Équipe Filloo ».
  nom          text not null check (char_length(btrim(nom)) between 1 and 60),
  created_at   timestamptz not null default now()
);

comment on table public.equipe is
  'Les membres de l''équipe Filloo, un compte chacun. Écrite SEULEMENT depuis le tableau de bord Supabase.';

alter table public.equipe enable row level security;

-- `security definer` : une policy de `equipe` ne peut pas lire `equipe`
-- (récursion du RLS), et les policies des autres tables en ont besoin.
-- Bornée à `auth.uid()` : elle ne répond que pour la personne connectée.
create or replace function public.je_suis_de_l_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.equipe where auth_user_id = (select auth.uid()));
$$;

revoke execute on function public.je_suis_de_l_equipe() from public, anon;
grant execute on function public.je_suis_de_l_equipe() to authenticated;

create policy "equipe: l'equipe voit ses membres"
  on public.equipe for select
  to authenticated
  using ((select public.je_suis_de_l_equipe()));
-- Aucune policy d'écriture : on n'entre pas dans l'équipe depuis un écran.


-- ---------------------------------------------------------------------
-- Peut écrire à l'équipe : un compte actif et non suspendu
-- ---------------------------------------------------------------------
create or replace function public.je_peux_ecrire_a_l_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where auth_user_id = (select auth.uid())
       and is_deleted = false
       and is_suspended = false
  );
$$;

revoke execute on function public.je_peux_ecrire_a_l_equipe() from public, anon;
grant execute on function public.je_peux_ecrire_a_l_equipe() to authenticated;


-- ---------------------------------------------------------------------
-- Les annonces
-- ---------------------------------------------------------------------
create type public.public_annonce as enum ('tous', 'clients', 'commercants');

create table public.annonces (
  id         uuid primary key default gen_random_uuid(),
  -- Le collègue qui l'a publiée ; l'annonce survit à son départ.
  auteur_id  uuid references auth.users(id) on delete set null,
  titre      text not null check (char_length(btrim(titre)) between 1 and 80),
  corps      text not null check (char_length(btrim(corps)) between 1 and 2000),
  public     public.public_annonce not null,
  created_at timestamptz not null default now()
);

comment on table public.annonces is
  'Les annonces de l''équipe Filloo. Publiées depuis /admin ; lues dans l''app par leurs destinataires.';

create table public.annonce_destinataires (
  annonce_id   uuid not null references public.annonces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  lue_at       timestamptz,
  primary key (annonce_id, auth_user_id)
);

-- « Mes annonces » et « combien de non lues » partent de la personne.
create index annonce_destinataires_personne_idx
  on public.annonce_destinataires (auth_user_id, annonce_id);

comment on table public.annonce_destinataires is
  'Qui reçoit chaque annonce, figé à la publication : seules les personnes déjà inscrites et du public visé.';

alter table public.annonces enable row level security;
alter table public.annonce_destinataires enable row level security;

create policy "annonces: je lis les miennes, l'equipe lit tout"
  on public.annonces for select
  to authenticated
  using (
    (select public.je_suis_de_l_equipe())
    or exists (
      select 1 from public.annonce_destinataires d
       where d.annonce_id = annonces.id
         and d.auth_user_id = (select auth.uid())
    )
  );

create policy "annonces: l'equipe publie en son nom"
  on public.annonces for insert
  to authenticated
  with check ((select public.je_suis_de_l_equipe()) and auteur_id = (select auth.uid()));
-- Ni modification ni suppression depuis un écran en v1 : une annonce
-- partie est lue ; la retirer se fait au tableau de bord.

create policy "annonce_destinataires: je vois les miennes, l'equipe voit tout"
  on public.annonce_destinataires for select
  to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.je_suis_de_l_equipe()));
-- Aucune écriture directe : la liste se remplit à la publication
-- (trigger ci-dessous), et « lue » passe par `marquer_annonces_lues`.

-- Les destinataires, figés à la publication. `security definer` : la
-- personne qui publie ne voit pas tous les profils à travers le RLS.
-- Une personne suspendue est incluse : la suspension coupe l'écriture,
-- jamais la lecture.
create or replace function public.annonce_fixer_destinataires()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.annonce_destinataires (annonce_id, auth_user_id)
  select distinct new.id, p.auth_user_id
    from public.profiles p
   where p.is_deleted = false
     and (
       new.public = 'tous'
       or (new.public = 'clients' and p.role = 'client')
       or (new.public = 'commercants' and p.role = 'merchant')
     );
  return null;
end;
$$;

revoke execute on function public.annonce_fixer_destinataires() from public, anon, authenticated;

create trigger annonces_fixer_destinataires
  after insert on public.annonces
  for each row execute function public.annonce_fixer_destinataires();

create or replace function public.marquer_annonces_lues()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.annonce_destinataires
     set lue_at = now()
   where auth_user_id = (select auth.uid())
     and lue_at is null;
$$;

revoke execute on function public.marquer_annonces_lues() from public, anon;
grant execute on function public.marquer_annonces_lues() to authenticated;


-- ---------------------------------------------------------------------
-- Le fil de chaque personne avec l'équipe
-- ---------------------------------------------------------------------
create table public.fil_equipe (
  id          uuid primary key default gen_random_uuid(),
  -- La personne dont c'est le fil (jamais un membre qui répond).
  fil_de      uuid not null references auth.users(id) on delete cascade,
  -- Qui a écrit : la personne elle-même, ou un collègue. Le collègue
  -- parti, le message reste.
  auteur_id   uuid references auth.users(id) on delete set null,
  de_l_equipe boolean not null,
  corps       text not null check (char_length(btrim(corps)) between 1 and 2000),
  -- L'annonce à laquelle la personne répond, s'il y en a une.
  annonce_id  uuid references public.annonces(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Lu par l'AUTRE côté : la personne pour un message de l'équipe,
  -- l'équipe pour un message de la personne.
  lu_at       timestamptz
);

create index fil_equipe_fil_idx on public.fil_equipe (fil_de, created_at desc);

comment on table public.fil_equipe is
  'Le fil privé entre une personne inscrite et l''équipe Filloo. Écrit depuis l''app (la personne) et depuis /admin (l''équipe).';

alter table public.fil_equipe enable row level security;

create policy "fil_equipe: je lis mon fil, l'equipe lit tout"
  on public.fil_equipe for select
  to authenticated
  using (fil_de = (select auth.uid()) or (select public.je_suis_de_l_equipe()));

create policy "fil_equipe: j'ecris dans mon fil"
  on public.fil_equipe for insert
  to authenticated
  with check (
    fil_de = (select auth.uid())
    and auteur_id = (select auth.uid())
    and de_l_equipe = false
    and (select public.je_peux_ecrire_a_l_equipe())
    and (
      annonce_id is null
      or exists (
        select 1 from public.annonce_destinataires d
         where d.annonce_id = fil_equipe.annonce_id
           and d.auth_user_id = (select auth.uid())
      )
    )
  );

create policy "fil_equipe: l'equipe repond en son nom"
  on public.fil_equipe for insert
  to authenticated
  with check (
    (select public.je_suis_de_l_equipe())
    and auteur_id = (select auth.uid())
    and de_l_equipe = true
    and annonce_id is null
  );
-- Ni modification ni suppression directes : « lu » passe par les deux
-- fonctions ci-dessous, qui ne touchent que `lu_at`.

-- L'heure et l'état « lu » ne viennent jamais du téléphone.
create or replace function public.fil_equipe_heure_du_serveur()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_at := now();
  new.lu_at := null;
  return new;
end;
$$;

create trigger fil_equipe_heure_du_serveur
  before insert on public.fil_equipe
  for each row execute function public.fil_equipe_heure_du_serveur();

-- La personne ouvre son fil : les réponses de l'équipe deviennent lues.
create or replace function public.marquer_fil_equipe_lu()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.fil_equipe
     set lu_at = now()
   where fil_de = (select auth.uid())
     and de_l_equipe = true
     and lu_at is null;
$$;

revoke execute on function public.marquer_fil_equipe_lu() from public, anon;
grant execute on function public.marquer_fil_equipe_lu() to authenticated;

-- Un collègue ouvre le fil d'une personne : ses messages deviennent lus
-- pour toute l'équipe. Vérifie QUI demande : hors équipe, rien ne bouge.
create or replace function public.marquer_fil_lu_par_l_equipe(p_fil_de uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.fil_equipe
     set lu_at = now()
   where fil_de = p_fil_de
     and de_l_equipe = false
     and lu_at is null
     and (select public.je_suis_de_l_equipe());
$$;

revoke execute on function public.marquer_fil_lu_par_l_equipe(uuid) from public, anon;
grant execute on function public.marquer_fil_lu_par_l_equipe(uuid) to authenticated;

-- La boîte de l'équipe : un fil par ligne, le plus récent d'abord, avec
-- le nom de la personne. `security definer` parce que l'équipe ne voit
-- pas tous les profils à travers le RLS ; vide pour qui n'en est pas.
create or replace function public.boite_equipe()
returns table (
  fil_de           uuid,
  nom              text,
  dernier_corps    text,
  dernier_at       timestamptz,
  dernier_de_l_equipe boolean,
  non_lus          bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with derniers as (
    select distinct on (f.fil_de)
           f.fil_de, f.corps, f.created_at, f.de_l_equipe
      from public.fil_equipe f
     order by f.fil_de, f.created_at desc
  )
  select d.fil_de,
         coalesce(
           (select p.full_name from public.profiles p
             where p.auth_user_id = d.fil_de and p.is_deleted = false
             order by p.created_at limit 1),
           'Compte supprimé'
         ),
         d.corps,
         d.created_at,
         d.de_l_equipe,
         (select count(*) from public.fil_equipe n
           where n.fil_de = d.fil_de and n.de_l_equipe = false and n.lu_at is null)
    from derniers d
   where (select public.je_suis_de_l_equipe())
   order by d.created_at desc;
$$;

revoke execute on function public.boite_equipe() from public, anon;
grant execute on function public.boite_equipe() to authenticated;
