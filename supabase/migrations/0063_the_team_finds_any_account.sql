-- =====================================================================
-- 0063 : l'équipe retrouve n'importe quel compte depuis /admin
-- =====================================================================
-- Décision du porteur du projet du 2026-11-07 : tout le site s'administre
-- depuis `/admin`, et tout membre de l'équipe a les mêmes droits. Avant
-- cette migration, l'équipe ne voyait un compte que s'il était signalé
-- (`signalements_a_traiter`) ou suspendu (`comptes_suspendus`, 0046).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Seule l'équipe lit la liste des comptes (`equipe_comptes`) : refus
--    pour tout autre appelant, fermée à `anon`. Elle lit l'email dans
--    `auth.users`, qu'aucun écran ne lit autrement.
-- 2. La recherche ignore la casse et les accents (`extensions.unaccent`,
--    présent depuis 0001, constaté en production le 2026-11-07) sur le
--    nom, le nom de boutique, le téléphone et l'email. Une recherche
--    faite seulement de chiffres, espaces, `+ - . ( )` compare aussi les
--    chiffres seuls du téléphone (« 621 63 00 01 » trouve « +224621630001 »). `%` et `_` tapés dans la recherche sont des caractères,
--    pas des jokers.
-- 3. Tri : comptes actifs d'abord, supprimés en dernier ; puis la
--    correspondance (exacte, puis début, puis ailleurs) ; puis le plus
--    récent. Sans recherche : les plus récents. Au plus 200 lignes.
--
-- Rien ne s'écrit ici : suspendre et réactiver restent
-- `suspendre_profil(p_profile uuid, p_motif text)` et
-- `reactiver_profil(p_profile uuid, p_motif text)` (0046, inchangées).
--
-- CHOIX
-- - Une ligne par PROFIL : une connexion qui porte un compte client et
--   un compte commerçant apparaît deux fois (même email), car on
--   suspend un profil, pas une connexion (0046).
-- - `ville` : celle de la boutique, sinon celle du profil client.
-- - `signalements_en_attente` : ceux qui VISENT ce compte (sa boutique,
--   ses produits, ses conversations), pas ceux qu'il a faits.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE : une fonction ajoutée, rien d'autre.

create or replace function public.equipe_comptes(p_recherche text default null, p_limite int default 50)
returns table (
  profile_id              uuid,
  nom                     text,
  role                    text,
  telephone               text,
  email                   text,
  merchant_id             uuid,
  shop_name               text,
  ville                   text,
  is_suspended            boolean,
  is_deleted              boolean,
  suspension_reason       text,
  created_at              timestamptz,
  produits                bigint,
  signalements_en_attente bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q        text := nullif(btrim(coalesce(p_recherche, '')), '');
  v_n        text;  -- la recherche sans accents ni majuscules
  v_echappe  text;  -- la même, jokers de LIKE neutralisés
  v_chiffres text;  -- ses chiffres seuls, pour un téléphone
  v_limite   int  := least(greatest(coalesce(p_limite, 50), 1), 200);
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  if v_q is not null then
    v_n := lower(extensions.unaccent(left(v_q, 80)));
    v_echappe := replace(replace(replace(v_n, '\', '\\'), '%', '\%'), '_', '\_');
    -- Seulement pour une recherche qui ressemble à un numéro : sinon
    -- « awa2024@… » trouverait tout téléphone contenant « 2024 ».
    if v_q ~ '^[0-9 +().-]+$' then
      v_chiffres := nullif(regexp_replace(v_q, '\D', '', 'g'), '');
      if char_length(v_chiffres) < 3 then
        v_chiffres := null;
      end if;
    end if;
  end if;

  return query
  select x.profile_id, x.nom, x.role, x.telephone, x.email, x.merchant_id, x.shop_name,
         x.ville, x.is_suspended, x.is_deleted, x.suspension_reason, x.created_at,
         x.produits, x.signalements_en_attente
    from (
      select p.id                                              as profile_id,
             p.full_name                                       as nom,
             p.role::text                                      as role,
             p.phone                                           as telephone,
             u.email::text                                     as email,
             m.id                                              as merchant_id,
             m.shop_name                                       as shop_name,
             ci.name                                           as ville,
             p.is_suspended                                    as is_suspended,
             p.is_deleted                                      as is_deleted,
             p.suspension_reason                               as suspension_reason,
             p.created_at                                      as created_at,
             (select count(*) from public.products pr where pr.merchant_id = m.id) as produits,
             (select count(*) from public.reports r
               where r.handled_at is null
                 and (   (r.target_type = 'merchant' and r.target_id = m.id)
                      or (r.target_type = 'product' and r.target_id in
                            (select pr.id from public.products pr where pr.merchant_id = m.id))
                      or (r.target_type = 'conversation' and r.target_id in
                            (select c.id from public.conversations c
                              where c.client_id = p.id or c.merchant_id = m.id)))
             )                                                 as signalements_en_attente,
             lower(extensions.unaccent(coalesce(p.full_name, ''))) as n_nom,
             lower(extensions.unaccent(coalesce(m.shop_name, ''))) as n_boutique,
             lower(coalesce(u.email::text, ''))                as n_email,
             regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') as n_tel
        from public.profiles p
        left join auth.users u      on u.id = p.auth_user_id
        left join public.merchants m on m.profile_id = p.id
        left join public.cities ci  on ci.id = coalesce(m.city_id, p.city_id)
    ) x
   cross join lateral (
     select case
              when v_q is null then 0
              when x.n_nom = v_n or x.n_boutique = v_n or x.n_email = v_n
                   or (v_chiffres is not null and x.n_tel = v_chiffres) then 0
              when x.n_nom like v_echappe || '%' or x.n_boutique like v_echappe || '%'
                   or x.n_email like v_echappe || '%'
                   or (v_chiffres is not null and x.n_tel like v_chiffres || '%') then 1
              else 2
            end as rang
   ) s
   where v_q is null
      or x.n_nom      like '%' || v_echappe || '%'
      or x.n_boutique like '%' || v_echappe || '%'
      or x.n_email    like '%' || v_echappe || '%'
      or lower(coalesce(x.telephone, '')) like '%' || v_echappe || '%'
      or (v_chiffres is not null and x.n_tel like '%' || v_chiffres || '%')
   order by x.is_deleted, s.rang, x.created_at desc, x.profile_id
   limit v_limite;
end;
$$;

comment on function public.equipe_comptes(text, int) is
  'Équipe seule (0063) : les comptes, recherche sans accents sur nom, boutique, téléphone, email ; supprimés en dernier.';

revoke execute on function public.equipe_comptes(text, int) from public, anon;
grant execute on function public.equipe_comptes(text, int) to authenticated;
