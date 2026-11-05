-- =====================================================================
-- 0044 : chaque espace a son propre fil avec l'équipe
-- =====================================================================
-- Constaté par le porteur du projet le 2026-11-05 : une connexion qui a
-- un compte client ET une boutique voyait le même fil avec l'équipe dans
-- les deux espaces. Or un client peut s'y plaindre d'un commerçant, et un
-- commerçant de son compte : les deux ne se mélangent pas, comme le reste
-- du site (« deux comptes liés, jamais mélangés sur un écran »).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Un message du fil appartient à UN espace (`espace` : client ou
--    commerçant). Le fil d'une personne, c'est (fil_de, espace).
-- 2. On n'écrit que depuis un espace qu'on possède, actif et non suspendu
--    (la suspension porte sur un compte, pas sur la connexion).
-- 3. On ne répond à une annonce que si elle concerne cet espace : « tous »
--    partout, « clients » côté client, « commerçants » côté boutique.
-- 4. « Lu » se marque espace par espace.
--
-- Les fonctions sans espace de 0042 sont remplacées (l'app mobile, pas
-- encore distribuée, est mise à jour en même temps).

alter table public.fil_equipe add column espace public.user_role;

-- Un seul fil existait (2 messages, écrits depuis l'espace client, constaté
-- le 2026-11-05) ; la règle générale le range du côté client s'il existe.
update public.fil_equipe f
   set espace = case
     when exists (select 1 from public.profiles p
                   where p.auth_user_id = f.fil_de and p.role = 'client' and not p.is_deleted)
     then 'client'::public.user_role
     else 'merchant'::public.user_role
   end;

alter table public.fil_equipe alter column espace set not null;

drop index if exists public.fil_equipe_fil_idx;
create index fil_equipe_fil_idx on public.fil_equipe (fil_de, espace, created_at desc);


-- Une annonce concerne-t-elle cet espace ?
create or replace function public.annonce_concerne(p_public public.public_annonce, p_espace public.user_role)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_public = 'tous'
      or (p_public = 'clients' and p_espace = 'client')
      or (p_public = 'commercants' and p_espace = 'merchant');
$$;


-- Écrire depuis un espace : le compte de ce rôle, actif et non suspendu.
-- L'ancienne version (sans espace) est retirée APRÈS la policy qui s'en
-- sert, plus bas.
create or replace function public.je_peux_ecrire_a_l_equipe(p_espace public.user_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where auth_user_id = (select auth.uid())
       and role = p_espace
       and is_deleted = false
       and is_suspended = false
  );
$$;

revoke execute on function public.je_peux_ecrire_a_l_equipe(public.user_role) from public, anon;
grant execute on function public.je_peux_ecrire_a_l_equipe(public.user_role) to authenticated;


alter policy "fil_equipe: j'ecris dans mon fil"
  on public.fil_equipe
  with check (
    fil_de = (select auth.uid())
    and auteur_id = (select auth.uid())
    and de_l_equipe = false
    and public.je_peux_ecrire_a_l_equipe(espace)
    and (
      annonce_id is null
      or exists (
        select 1
          from public.annonce_destinataires d
          join public.annonces a on a.id = d.annonce_id
         where d.annonce_id = fil_equipe.annonce_id
           and d.auth_user_id = (select auth.uid())
           and public.annonce_concerne(a.public, fil_equipe.espace)
      )
    )
  );


drop function public.je_peux_ecrire_a_l_equipe();


-- Lu, espace par espace.
drop function if exists public.marquer_fil_equipe_lu();
create or replace function public.marquer_fil_equipe_lu(p_espace public.user_role)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.fil_equipe
     set lu_at = now()
   where fil_de = (select auth.uid())
     and espace = p_espace
     and de_l_equipe = true
     and lu_at is null;
$$;

revoke execute on function public.marquer_fil_equipe_lu(public.user_role) from public, anon;
grant execute on function public.marquer_fil_equipe_lu(public.user_role) to authenticated;

drop function if exists public.marquer_fil_lu_par_l_equipe(uuid);
create or replace function public.marquer_fil_lu_par_l_equipe(p_fil_de uuid, p_espace public.user_role)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.fil_equipe
     set lu_at = now()
   where fil_de = p_fil_de
     and espace = p_espace
     and de_l_equipe = false
     and lu_at is null
     and (select public.je_suis_de_l_equipe());
$$;

revoke execute on function public.marquer_fil_lu_par_l_equipe(uuid, public.user_role) from public, anon;
grant execute on function public.marquer_fil_lu_par_l_equipe(uuid, public.user_role) to authenticated;

-- Une annonce « tous » lue dans un espace l'est dans l'autre : c'est la
-- même annonce. Une annonce d'un seul public ne se marque que là où elle
-- se lit.
drop function if exists public.marquer_annonces_lues();
create or replace function public.marquer_annonces_lues(p_espace public.user_role)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.annonce_destinataires d
     set lue_at = now()
    from public.annonces a
   where a.id = d.annonce_id
     and d.auth_user_id = (select auth.uid())
     and d.lue_at is null
     and public.annonce_concerne(a.public, p_espace);
$$;

revoke execute on function public.marquer_annonces_lues(public.user_role) from public, anon;
grant execute on function public.marquer_annonces_lues(public.user_role) to authenticated;


-- La boîte de l'équipe : un fil par (personne, espace). Côté boutique, le
-- nom affiché est celui de la boutique, ce que l'équipe connaît.
drop function if exists public.boite_equipe();
create or replace function public.boite_equipe()
returns table (
  fil_de              uuid,
  espace              public.user_role,
  nom                 text,
  dernier_corps       text,
  dernier_at          timestamptz,
  dernier_de_l_equipe boolean,
  non_lus             bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with derniers as (
    select distinct on (f.fil_de, f.espace)
           f.fil_de, f.espace, f.corps, f.created_at, f.de_l_equipe
      from public.fil_equipe f
     order by f.fil_de, f.espace, f.created_at desc
  )
  select d.fil_de,
         d.espace,
         coalesce(
           (select coalesce(m.shop_name, p.full_name)
              from public.profiles p
              left join public.merchants m on m.profile_id = p.id
             where p.auth_user_id = d.fil_de and p.role = d.espace and p.is_deleted = false
             limit 1),
           'Compte supprimé'
         ),
         d.corps,
         d.created_at,
         d.de_l_equipe,
         (select count(*) from public.fil_equipe n
           where n.fil_de = d.fil_de and n.espace = d.espace
             and n.de_l_equipe = false and n.lu_at is null)
    from derniers d
   where (select public.je_suis_de_l_equipe())
   order by d.created_at desc;
$$;

revoke execute on function public.boite_equipe() from public, anon;
grant execute on function public.boite_equipe() to authenticated;
