-- =====================================================================
-- 0045 : l'équipe gère ses annonces
-- =====================================================================
-- Décision du porteur du projet du 2026-11-06 : sur /admin, une annonce
-- se prépare en BROUILLON, se PROGRAMME pour un jour (elle part le matin,
-- au passage du cron de 7 h, heure de Conakry), se PUBLIE, se MODIFIE
-- (mention « Modifiée », sans nouvelle notification) et se RETIRE. Tout
-- membre de l'équipe peut le faire ; la base garde qui a fait quoi.
-- L'équipe voit aussi qui a lu chaque annonce.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Un utilisateur ne voit QUE les annonces publiées qui lui sont
--    destinées : ni brouillon, ni programmée, ni retirée.
-- 2. Les destinataires sont figés au moment de la PUBLICATION (et non plus
--    de la création) : les inscrits de ce jour-là, du public visé.
-- 3. Le cycle ne recule pas : brouillon ⇄ programmée → publiée → retirée.
--    Une annonce publiée ne change plus de public (ses destinataires sont
--    figés) ; une annonce retirée ne change plus du tout.
-- 4. L'auteur et la date de création ne se réécrivent pas ; publication,
--    modification et retrait se datent et se signent par le serveur.
-- 5. Un brouillon ou une annonce programmée se supprime ; une annonce
--    publiée ne se supprime pas, elle se retire (la trace reste).

create type public.etat_annonce as enum ('brouillon', 'programmee', 'publiee', 'retiree');

alter table public.annonces
  add column etat           public.etat_annonce not null default 'publiee',
  add column programmee_pour date,
  add column publiee_at     timestamptz,
  add column modifiee_at    timestamptz,
  add column modifiee_par   uuid references auth.users(id) on delete set null,
  add column retiree_at     timestamptz,
  add column retiree_par    uuid references auth.users(id) on delete set null;

-- Les annonces existantes étaient publiées à leur création.
update public.annonces set publiee_at = created_at;

alter table public.annonces
  add constraint annonces_programmee_a_une_date
  check (etat <> 'programmee' or programmee_pour is not null);

-- Une nouvelle annonce part en brouillon si rien n'est dit.
alter table public.annonces alter column etat set default 'brouillon';

create index annonces_programmees_idx on public.annonces (programmee_pour) where etat = 'programmee';


-- ---------------------------------------------------------------------
-- Le cycle d'une annonce, tenu par la base
-- ---------------------------------------------------------------------
-- `security definer` : elle lit `auth.uid()` pour signer, et ne touche
-- que la ligne en cours (NEW). Appelable par le seul déclencheur.
create or replace function public.annonce_tenir_le_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.modifiee_at := null; new.modifiee_par := null;
    new.retiree_at := null;  new.retiree_par := null;
    if new.etat = 'retiree' then
      raise exception 'Une annonce ne naît pas retirée.';
    end if;
    if new.etat = 'programmee' and new.programmee_pour <= current_date then
      raise exception 'Choisissez une date à partir de demain.';
    end if;
    new.publiee_at := case when new.etat = 'publiee' then now() end;
    if new.etat <> 'programmee' then new.programmee_pour := null; end if;
    return new;
  end if;

  -- UPDATE : ce qui ne se réécrit jamais.
  new.id := old.id;
  new.auteur_id := old.auteur_id;
  new.created_at := old.created_at;

  if old.etat = 'retiree' then
    raise exception 'Une annonce retirée ne se modifie plus.';
  end if;
  if old.etat = 'publiee' and new.etat in ('brouillon', 'programmee') then
    raise exception 'Une annonce publiée ne redevient pas un brouillon : retirez-la.';
  end if;
  if old.etat = 'publiee' and new.public <> old.public then
    raise exception 'Les destinataires d''une annonce publiée sont figés : retirez-la et publiez-en une nouvelle.';
  end if;

  if new.etat = 'programmee' then
    if new.programmee_pour is null or (new.programmee_pour <= current_date
        and (old.etat <> 'programmee' or new.programmee_pour is distinct from old.programmee_pour)) then
      raise exception 'Choisissez une date à partir de demain.';
    end if;
  else
    new.programmee_pour := null;
  end if;

  if new.etat = 'publiee' and old.etat <> 'publiee' then
    new.publiee_at := now();
  else
    new.publiee_at := old.publiee_at;
  end if;

  if old.etat = 'publiee' and new.etat = 'publiee'
     and (new.titre <> old.titre or new.corps <> old.corps) then
    new.modifiee_at := now();
    new.modifiee_par := (select auth.uid());
  else
    new.modifiee_at := old.modifiee_at;
    new.modifiee_par := old.modifiee_par;
  end if;

  if new.etat = 'retiree' then
    new.retiree_at := now();
    new.retiree_par := (select auth.uid());
  else
    new.retiree_at := null;
    new.retiree_par := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.annonce_tenir_le_cycle() from public, anon, authenticated;

create trigger annonces_tenir_le_cycle
  before insert or update on public.annonces
  for each row execute function public.annonce_tenir_le_cycle();


-- Les destinataires, figés à la PUBLICATION : à la création d'une annonce
-- publiée tout de suite, ou au passage d'un brouillon / d'une programmée
-- à « publiée ». Même règle qu'en 0043 : l'équipe n'en reçoit jamais.
create or replace function public.annonce_fixer_destinataires()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.etat <> 'publiee' or (tg_op = 'UPDATE' and old.etat = 'publiee') then
    return null;
  end if;
  insert into public.annonce_destinataires (annonce_id, auth_user_id)
  select distinct new.id, p.auth_user_id
    from public.profiles p
   where p.is_deleted = false
     and not exists (select 1 from public.equipe e where e.auth_user_id = p.auth_user_id)
     and (
       new.public = 'tous'
       or (new.public = 'clients' and p.role = 'client')
       or (new.public = 'commercants' and p.role = 'merchant')
     )
  on conflict do nothing;
  return null;
end;
$$;

revoke execute on function public.annonce_fixer_destinataires() from public, anon, authenticated;

drop trigger annonces_fixer_destinataires on public.annonces;
create trigger annonces_fixer_destinataires
  after insert or update of etat on public.annonces
  for each row execute function public.annonce_fixer_destinataires();


-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter policy "annonces: je lis les miennes, l'equipe lit tout"
  on public.annonces
  using (
    (select public.je_suis_de_l_equipe())
    or (
      etat = 'publiee'
      and exists (
        select 1 from public.annonce_destinataires d
         where d.annonce_id = annonces.id
           and d.auth_user_id = (select auth.uid())
      )
    )
  );

create policy "annonces: l'equipe les modifie"
  on public.annonces for update
  to authenticated
  using ((select public.je_suis_de_l_equipe()))
  with check ((select public.je_suis_de_l_equipe()));

create policy "annonces: l'equipe supprime un brouillon ou une programmee"
  on public.annonces for delete
  to authenticated
  using ((select public.je_suis_de_l_equipe()) and etat in ('brouillon', 'programmee'));


-- ---------------------------------------------------------------------
-- Le passage du matin : publier ce qui est programmé pour aujourd'hui
-- ---------------------------------------------------------------------
-- Appelée par le cron du site (`/api/quotidien`, 7 h UTC = 7 h à
-- Conakry) en `service_role`. Rend les annonces publiées, pour que le
-- site envoie les notifications.
create or replace function public.publier_annonces_programmees()
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  update public.annonces
     set etat = 'publiee'
   where etat = 'programmee'
     and programmee_pour <= current_date
  returning id;
$$;

revoke execute on function public.publier_annonces_programmees() from public, anon, authenticated;
grant execute on function public.publier_annonces_programmees() to service_role;


-- ---------------------------------------------------------------------
-- Qui a lu une annonce
-- ---------------------------------------------------------------------
-- `security definer` : l'équipe ne voit pas tous les profils à travers
-- le RLS. Vide pour qui n'est pas de l'équipe. Le nom est celui du compte
-- visé par l'annonce (la boutique pour « commerçants »).
create or replace function public.lecteurs_annonce(p_annonce uuid)
returns table (auth_user_id uuid, nom text, lue_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.auth_user_id,
         coalesce(
           (select coalesce(case when a.public = 'commercants' then m.shop_name end, p.full_name)
              from public.profiles p
              left join public.merchants m on m.profile_id = p.id
             where p.auth_user_id = d.auth_user_id
               and p.is_deleted = false
               and (a.public = 'tous'
                    or (a.public = 'clients' and p.role = 'client')
                    or (a.public = 'commercants' and p.role = 'merchant'))
             order by p.created_at
             limit 1),
           'Compte supprimé'
         ),
         d.lue_at
    from public.annonce_destinataires d
    join public.annonces a on a.id = d.annonce_id
   where d.annonce_id = p_annonce
     and (select public.je_suis_de_l_equipe())
   order by d.lue_at desc nulls last, 2;
$$;

revoke execute on function public.lecteurs_annonce(uuid) from public, anon;
grant execute on function public.lecteurs_annonce(uuid) to authenticated;
