-- =====================================================================
-- 0066 : l'équipe tient la liste des catégories et des villes
-- =====================================================================
-- Décision du porteur du projet du 2026-11-07 : tout s'administre depuis
-- `/admin`. Jusqu'ici `categories` et `cities` ne changeaient que par
-- migration ou au tableau de bord (lecture seule pour tous depuis 0002).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Les deux listes restent en LECTURE SEULE pour tout écran : aucun
--    droit d'écriture de table n'est ouvert, aucune policy d'écriture.
--    Seule l'équipe les change, par les quatre fonctions ci-dessous, et
--    chaque geste s'inscrit au journal.
-- 2. Le `slug` d'une catégorie ne change JAMAIS après sa création : il
--    sert aux adresses du site et à l'app. À la création il est dérivé du
--    nom (sans accents, minuscules, tirets) et rendu unique (`-2`, `-3`…).
-- 3. Un nom fait 2 à 40 caractères, espaces superflus retirés ; deux
--    catégories (ou deux villes) ne portent pas le même nom, à la casse et
--    aux accents près. Une position va de 0 à 9999 ; absente à la
--    création, l'élément va en fin de liste ; absente à la modification,
--    elle ne bouge pas.
-- 4. On ne retire pas une catégorie qu'un produit (ou une campagne,
--    0047) utilise, ni une ville qu'une boutique ou un profil utilise : le
--    message dit combien. Les produits n'ont pas de ville propre (celle de
--    leur boutique, 0001). Toute autre référence future est arrêtée par
--    sa clé étrangère, traduite en message clair.
-- 5. Droits retirés à `anon` et `authenticated` : `truncate` (qui ignore
--    le RLS), `trigger`, `references` sur les deux tables (constatés en
--    production le 2026-11-07, accordés par défaut, servis à personne).
--
-- CHOIX
-- - `journal_equipe.cible_id` est un uuid, ces listes ont un id entier :
--   plutôt qu'ajouter une colonne à deux tables lues par l'app installée
--   et le site (`select('*')`), la cible est un uuid DÉDUIT de l'id
--   (`00000000-0000-0000-0000-<id en hexadécimal>`, fonction
--   `cible_journal_entier`). Un id `serial` ne resservant jamais, le lien
--   reste unique ; `cible_type` distingue catégorie et ville. Le motif dit
--   le nom (et l'ancien nom) en clair.
-- - `fixer_*` : tous les paramètres ont un défaut, car le site appelle
--   `p_id: id ?? undefined` (supabase-js retire la clé, PostgREST ne
--   trouve alors la fonction que si `p_id` a un défaut, et un paramètre à
--   défaut impose un défaut aux suivants). `p_nom` absent est refusé.
-- - `fixer_*` rend l'id de l'élément (créé ou modifié).
-- - Une modification qui ne change rien n'écrit rien au journal.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE : elle lit `categories(id, name)` et
-- `cities(id, name)` triées par `position` (constaté le 2026-11-07,
-- `src/lib/catalogue.ts` sur `main`), et `categories(name)` en jointure :
-- aucune colonne ne change. Un élément ajouté apparaît à la prochaine
-- lecture. Un élément retiré n'est utilisé par personne ; si un écran
-- ouvert le proposait encore, l'enregistrement échoue sur la clé
-- étrangère (message technique), sans rien abîmer.


-- ---------------------------------------------------------------------
-- 1. Les droits inutiles s'en vont, rien ne s'ouvre
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on public.categories from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.cities     from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Le journal connaît les catégories et les villes
-- ---------------------------------------------------------------------
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'demasquer_produit', 'ajouter_membre', 'retirer_membre',
                    'fixer_categorie', 'retirer_categorie', 'fixer_ville', 'retirer_ville'));

alter table public.journal_equipe drop constraint journal_equipe_cible_type_check;
alter table public.journal_equipe add constraint journal_equipe_cible_type_check
  check (cible_type in ('profil', 'produit', 'signalement', 'campagne', 'membre', 'categorie', 'ville'));


-- ---------------------------------------------------------------------
-- 3. Outils internes
-- ---------------------------------------------------------------------
create or replace function public.cible_journal_entier(p_id int)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select ('00000000-0000-0000-0000-' || lpad(to_hex(p_id), 12, '0'))::uuid;
$$;

comment on function public.cible_journal_entier(int) is
  'Uuid de journal_equipe.cible_id déduit d''un id entier (catégorie, ville ; 0066).';

revoke execute on function public.cible_journal_entier(int) from public, anon, authenticated;


-- Le nom tel qu'on le compare : sans accents, sans majuscules, espaces
-- réduits.
create or replace function public.nom_compare(p_nom text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(extensions.unaccent(regexp_replace(btrim(coalesce(p_nom, '')), '\s+', ' ', 'g')));
$$;

revoke execute on function public.nom_compare(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. Les catégories
-- ---------------------------------------------------------------------
create or replace function public.fixer_categorie(
  p_id       int  default null,
  p_nom      text default null,
  p_position int  default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom       text := regexp_replace(btrim(coalesce(p_nom, '')), '\s+', ' ', 'g');
  v_base      text;
  v_slug      text;
  v_i         int  := 1;
  v_id        int;
  v_ancien    public.categories%rowtype;
  v_position  int;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_nom) not between 2 and 40 then
    raise exception 'Le nom fait de 2 à 40 caractères.';
  end if;
  if p_position is not null and p_position not between 0 and 9999 then
    raise exception 'La position va de 0 à 9999.';
  end if;

  -- Verrou de la liste : deux créations simultanées du même nom ne
  -- passent pas toutes les deux le contrôle ci-dessous.
  lock table public.categories in share row exclusive mode;

  if exists (select 1 from public.categories c
              where public.nom_compare(c.name) = public.nom_compare(v_nom)
                and c.id is distinct from p_id) then
    raise exception 'Une catégorie porte déjà ce nom.';
  end if;

  if p_id is null then
    v_base := btrim(regexp_replace(lower(extensions.unaccent(v_nom)), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then
      v_base := 'categorie';
    end if;
    v_slug := v_base;
    while exists (select 1 from public.categories c where c.slug = v_slug) loop
      v_i := v_i + 1;
      v_slug := v_base || '-' || v_i;
    end loop;
    v_position := coalesce(p_position, (select coalesce(max(c.position), 0) + 1 from public.categories c));

    insert into public.categories (slug, name, position)
    values (v_slug, v_nom, v_position)
    returning id into v_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'fixer_categorie', 'categorie', public.cible_journal_entier(v_id),
           left('Création : ' || v_nom || ' (' || v_slug || ', position ' || v_position || ')', 500)
      from public.equipe e where e.auth_user_id = (select auth.uid());
    return v_id;
  end if;

  select * into v_ancien from public.categories c where c.id = p_id for update;
  if not found then
    raise exception 'Catégorie introuvable.';
  end if;
  v_position := coalesce(p_position, v_ancien.position);
  if v_ancien.name = v_nom and v_ancien.position = v_position then
    return p_id;
  end if;

  -- Le slug n'est pas dans la liste : il ne change jamais.
  update public.categories c
     set name = v_nom, position = v_position
   where c.id = p_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'fixer_categorie', 'categorie', public.cible_journal_entier(p_id),
         left(v_ancien.name || ' → ' || v_nom || ' (' || v_ancien.slug || ', position '
              || v_ancien.position || ' → ' || v_position || ')', 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
  return p_id;
end;
$$;

comment on function public.fixer_categorie(int, text, int) is
  'Équipe seule (0066) : crée (p_id null) ou renomme / déplace une catégorie. Le slug ne change jamais.';

revoke execute on function public.fixer_categorie(int, text, int) from public, anon;
grant execute on function public.fixer_categorie(int, text, int) to authenticated;


create or replace function public.retirer_categorie(p_id int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien    public.categories%rowtype;
  v_produits  bigint;
  v_campagnes bigint;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  select * into v_ancien from public.categories c where c.id = p_id for update;
  if not found then
    raise exception 'Catégorie introuvable.';
  end if;

  select count(*) into v_produits from public.products pr where pr.category_id = p_id;
  if v_produits > 0 then
    raise exception 'Impossible de retirer « % » : % produit(s) l''utilise(nt). Changez-les de catégorie d''abord.',
      v_ancien.name, v_produits;
  end if;
  select count(*) into v_campagnes from public.campagnes ca where ca.category_id = p_id;
  if v_campagnes > 0 then
    raise exception 'Impossible de retirer « % » : % campagne(s) de publicité la visent.',
      v_ancien.name, v_campagnes;
  end if;

  begin
    delete from public.categories c where c.id = p_id;
  exception when foreign_key_violation then
    raise exception 'Impossible de retirer « % » : elle est encore utilisée ailleurs.', v_ancien.name;
  end;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'retirer_categorie', 'categorie', public.cible_journal_entier(p_id),
         left(v_ancien.name || ' (' || v_ancien.slug || ')', 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.retirer_categorie(int) is
  'Équipe seule (0066) : retire une catégorie qu''aucun produit ni campagne n''utilise.';

revoke execute on function public.retirer_categorie(int) from public, anon;
grant execute on function public.retirer_categorie(int) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Les villes
-- ---------------------------------------------------------------------
create or replace function public.fixer_ville(
  p_id       int  default null,
  p_nom      text default null,
  p_position int  default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom      text := regexp_replace(btrim(coalesce(p_nom, '')), '\s+', ' ', 'g');
  v_id       int;
  v_ancien   public.cities%rowtype;
  v_position int;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_nom) not between 2 and 40 then
    raise exception 'Le nom fait de 2 à 40 caractères.';
  end if;
  if p_position is not null and p_position not between 0 and 9999 then
    raise exception 'La position va de 0 à 9999.';
  end if;

  lock table public.cities in share row exclusive mode;

  if exists (select 1 from public.cities ci
              where public.nom_compare(ci.name) = public.nom_compare(v_nom)
                and ci.id is distinct from p_id) then
    raise exception 'Une ville porte déjà ce nom.';
  end if;

  if p_id is null then
    v_position := coalesce(p_position, (select coalesce(max(ci.position), 0) + 1 from public.cities ci));
    insert into public.cities (name, position)
    values (v_nom, v_position)
    returning id into v_id;

    insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
    select e.auth_user_id, e.nom, 'fixer_ville', 'ville', public.cible_journal_entier(v_id),
           left('Création : ' || v_nom || ' (position ' || v_position || ')', 500)
      from public.equipe e where e.auth_user_id = (select auth.uid());
    return v_id;
  end if;

  select * into v_ancien from public.cities ci where ci.id = p_id for update;
  if not found then
    raise exception 'Ville introuvable.';
  end if;
  v_position := coalesce(p_position, v_ancien.position);
  if v_ancien.name = v_nom and v_ancien.position = v_position then
    return p_id;
  end if;

  update public.cities ci
     set name = v_nom, position = v_position
   where ci.id = p_id;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'fixer_ville', 'ville', public.cible_journal_entier(p_id),
         left(v_ancien.name || ' → ' || v_nom || ' (position ' || v_ancien.position || ' → ' || v_position || ')', 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
  return p_id;
end;
$$;

comment on function public.fixer_ville(int, text, int) is
  'Équipe seule (0066) : crée (p_id null) ou renomme / déplace une ville.';

revoke execute on function public.fixer_ville(int, text, int) from public, anon;
grant execute on function public.fixer_ville(int, text, int) to authenticated;


create or replace function public.retirer_ville(p_id int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien    public.cities%rowtype;
  v_boutiques bigint;
  v_profils   bigint;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  select * into v_ancien from public.cities ci where ci.id = p_id for update;
  if not found then
    raise exception 'Ville introuvable.';
  end if;

  select count(*) into v_boutiques from public.merchants m where m.city_id = p_id;
  select count(*) into v_profils   from public.profiles p  where p.city_id = p_id;
  if v_boutiques > 0 or v_profils > 0 then
    raise exception 'Impossible de retirer « % » : % boutique(s) et % profil(s) l''utilisent.',
      v_ancien.name, v_boutiques, v_profils;
  end if;

  begin
    delete from public.cities ci where ci.id = p_id;
  exception when foreign_key_violation then
    raise exception 'Impossible de retirer « % » : elle est encore utilisée ailleurs.', v_ancien.name;
  end;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'retirer_ville', 'ville', public.cible_journal_entier(p_id),
         left(v_ancien.name, 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.retirer_ville(int) is
  'Équipe seule (0066) : retire une ville qu''aucune boutique ni aucun profil n''utilise.';

revoke execute on function public.retirer_ville(int) from public, anon;
grant execute on function public.retirer_ville(int) to authenticated;
