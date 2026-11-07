-- =====================================================================
-- 0065 : l'équipe fait entrer et sortir ses membres depuis /admin
-- =====================================================================
-- Décision du porteur du projet du 2026-11-07 : tout s'administre depuis
-- `/admin`, et tout membre a les mêmes droits. Jusqu'ici (0042), seul le
-- tableau de bord Supabase faisait entrer quelqu'un dans `equipe`.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Seul un membre de l'équipe ajoute ou retire un membre, par
--    `ajouter_membre` / `retirer_membre`, et chaque geste s'inscrit au
--    journal. Aucun écran n'écrit `equipe` en direct : les droits
--    d'écriture de table sont retirés à `anon` et `authenticated` (le
--    RLS les refusait déjà, aucune policy d'écriture depuis 0042).
-- 2. On n'ajoute qu'une connexion qui EXISTE, dont l'email est CONFIRMÉ,
--    non supprimée ni anonyme : on ne crée pas de compte ici.
-- 3. La marque `app_metadata.equipe` que le site lit (0043) suit : elle
--    est posée et retirée par le déclencheur `equipe_marquer_la_connexion`
--    (0043), à l'insertion et à la suppression dans `equipe`. Aucune
--    fonction ici ne l'écrit à la main : `equipe` reste la seule source.
-- 4. On ne se retire pas soi-même, et l'équipe ne se vide jamais : le
--    dernier membre ne se retire pas. Les lignes de `equipe` sont
--    verrouillées pendant le geste : deux membres qui se retirent l'un
--    l'autre au même instant n'emportent pas l'équipe entière.
-- 5. Un membre retiré garde ses traces : ses messages au fil
--    (`fil_equipe.auteur_id` → `auth.users`, pas `equipe`), ses annonces
--    (`annonces.auteur_id` → `auth.users`), son nom dans le journal
--    (`auteur_nom`, copié). Les références vers `equipe`
--    (`journal_equipe.auteur`, `reports.handled_by`,
--    `campagnes.decidee_par`) sont `on delete set null` (constaté en
--    production le 2026-11-07, `pg_constraint`) : rien ne bloque, rien
--    n'est effacé.
--
-- CHOIX
-- - `cible_type = 'membre'`, `cible_id` = la connexion (`auth.users.id`).
--   Le motif du journal dit le nom et l'email au moment du geste.
-- - La session d'un membre retiré garde sa marque dans son jeton jusqu'au
--   prochain rafraîchissement ; la base, elle, le refuse aussitôt
--   (`je_suis_de_l_equipe()` lit `equipe`, pas le jeton).
-- - Une personne qui a déjà un compte client ou boutique peut entrer
--   dans l'équipe ; elle perd alors l'accès à ces espaces sur le site
--   (0043). Pas de refus ici : décision humaine, l'écran doit le dire.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE : l'app ne lit ni n'écrit `equipe`
-- (constaté le 2026-11-07, branche `main` de Filloo-mobile) ; seuls des
-- ajouts et un retrait de droits qui ne servaient à personne.


-- ---------------------------------------------------------------------
-- 1. Personne n'écrit `equipe` en direct
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on public.equipe from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Le journal connaît les membres
-- ---------------------------------------------------------------------
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'demasquer_produit', 'ajouter_membre', 'retirer_membre'));

alter table public.journal_equipe drop constraint journal_equipe_cible_type_check;
alter table public.journal_equipe add constraint journal_equipe_cible_type_check
  check (cible_type in ('profil', 'produit', 'signalement', 'campagne', 'membre'));


-- ---------------------------------------------------------------------
-- 3. Les membres
-- ---------------------------------------------------------------------
create or replace function public.equipe_membres()
returns table (auth_user_id uuid, nom text, email text, created_at timestamptz, moi boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  return query
  select e.auth_user_id, e.nom, u.email::text, e.created_at,
         e.auth_user_id = (select auth.uid())
    from public.equipe e
    left join auth.users u on u.id = e.auth_user_id
   order by e.created_at, e.nom, e.auth_user_id;
end;
$$;

comment on function public.equipe_membres() is
  'Équipe seule (0065) : les membres, leur email et « moi ».';

revoke execute on function public.equipe_membres() from public, anon;
grant execute on function public.equipe_membres() to authenticated;


create or replace function public.ajouter_membre(p_email text, p_nom text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nom   text := btrim(coalesce(p_nom, ''));
  v_ids   uuid[];
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_nom) not between 1 and 60 then
    raise exception 'Le prénom affiché aux collègues fait de 1 à 60 caractères.';
  end if;
  if v_email = '' then
    raise exception 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire sur Filloo.';
  end if;

  select array_agg(u.id) into v_ids
    from auth.users u
   where lower(u.email) = v_email
     and u.email_confirmed_at is not null
     and u.deleted_at is null
     and coalesce(u.is_anonymous, false) = false;
  if v_ids is null then
    raise exception 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire sur Filloo.';
  end if;
  if cardinality(v_ids) > 1 then
    raise exception 'Plusieurs comptes portent cette adresse : ajoutez ce membre depuis le tableau de bord Supabase.';
  end if;

  -- Verrou de toute l'équipe : même ordre que `retirer_membre`.
  perform 1 from public.equipe e for update;
  if exists (select 1 from public.equipe e where e.auth_user_id = v_ids[1]) then
    raise exception 'Cette personne fait déjà partie de l''équipe.';
  end if;

  -- Le déclencheur de 0043 pose `app_metadata.equipe = true`.
  insert into public.equipe (auth_user_id, nom) values (v_ids[1], v_nom);

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'ajouter_membre', 'membre', v_ids[1], left(v_nom || ' <' || v_email || '>', 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.ajouter_membre(text, text) is
  'Équipe seule (0065) : fait entrer une connexion existante et confirmée ; la marque app_metadata suit (0043).';

revoke execute on function public.ajouter_membre(text, text) from public, anon;
grant execute on function public.ajouter_membre(text, text) to authenticated;


create or replace function public.retirer_membre(p_auth uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom    text;
  v_email  text;
  v_restes int;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if p_auth = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas vous retirer vous-même de l''équipe.';
  end if;

  perform 1 from public.equipe e for update;

  -- Relu APRÈS le verrou : un collègue a pu retirer l'appelant entre-temps.
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  select e.nom, u.email::text into v_nom, v_email
    from public.equipe e left join auth.users u on u.id = e.auth_user_id
   where e.auth_user_id = p_auth;
  if not found then
    raise exception 'Ce compte ne fait pas partie de l''équipe.';
  end if;
  select count(*) into v_restes from public.equipe e;
  if v_restes <= 1 then
    raise exception 'Impossible de retirer le dernier membre de l''équipe.';
  end if;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'retirer_membre', 'membre', p_auth,
         left(v_nom || coalesce(' <' || v_email || '>', ''), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());

  -- Le déclencheur de 0043 retire la marque ; les références vers
  -- `equipe` passent à null, les messages et annonces restent.
  delete from public.equipe e where e.auth_user_id = p_auth;
end;
$$;

comment on function public.retirer_membre(uuid) is
  'Équipe seule (0065) : fait sortir un collègue (ni soi-même, ni le dernier) ; ses messages restent.';

revoke execute on function public.retirer_membre(uuid) from public, anon;
grant execute on function public.retirer_membre(uuid) to authenticated;
