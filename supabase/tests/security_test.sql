-- =====================================================================
-- Filloo — tests de sécurité
-- =====================================================================
-- Ces tests simulent de vrais utilisateurs et vérifient qu'ils ne peuvent
-- PAS faire ce qui leur est interdit. Un test de sécurité qui ne vérifie
-- que les cas autorisés ne sert à rien : ce sont les refus qui comptent.
--
-- Exécution locale : voir supabase/tests/README.md
-- =====================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Un test doit pouvoir être relancé sans reconstruire la base. On repart
-- donc d'une table vide. `cascade` suffit : la suppression se propage par
-- les clés étrangères jusqu'aux messages, ce qui vérifie au passage que le
-- chaînage est correct.
-- `truncate … cascade` suit AUSSI `tarifs_publicite.modifie_par` (vers
-- `equipe`, 0048) et viderait les tarifs : on les garde avant, et la
-- section 0048 les remet.
create temp table tarifs_origine as select type, duree_jours, prix_gnf from public.tarifs_publicite;
-- Même chose pour `tarifs_abonnement` (0049), remis dans la section 0049.
-- `credits_inclus` (0050) aussi, remis dans la section 0050.
create temp table tarifs_abo_origine as select formule, prix_gnf, credits_inclus from public.tarifs_abonnement;
truncate auth.users cascade;

create or replace function pg_temp.check(label text, condition boolean) returns void
language plpgsql as $$
begin
  if condition then raise notice 'OK    %', label;
  else raise exception 'ECHEC %', label;
  end if;
end $$;

create or replace function pg_temp.login(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
end $$;


-- --- Jeu de données ---------------------------------------------------
-- A, B : commerçants · C, D : clients · E, F : clients pour les quotas
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.gn', '{"role":"merchant","full_name":"Boutique A","phone":"620000001"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.gn', '{"role":"merchant","full_name":"Boutique B","phone":"620000002"}'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.gn', '{"role":"client","full_name":"Client C","phone":"620000003"}'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.gn', '{"role":"client","full_name":"Client D","phone":"620000004"}'),
  ('55555555-5555-5555-5555-555555555555', 'e@test.gn', '{"role":"client","full_name":"Client E","phone":"620000005"}'),
  ('66666666-6666-6666-6666-666666666666', 'f@test.gn', '{"role":"client","full_name":"Client F","phone":"620000006"}');

-- Le trigger handle_new_user vient de créer un profil par personne avec un
-- id ALÉATOIRE : depuis la décision des comptes liés, profiles.id n'est
-- plus égal à auth.users.id (voir 0001_schema.sql, partie « Profils »).
-- On réaligne les deux pour garder tout le reste de ce fichier lisible
-- avec les mêmes UUID que ceux utilisés pour se connecter (pg_temp.login).
-- Sans risque de collision : chacune de ces six personnes n'a encore
-- qu'un seul profil à ce stade du script.
update public.profiles set id = auth_user_id;

insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Chez A', 1),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Chez B', 1);


-- =====================================================================
-- 1. Inscription
-- =====================================================================
select pg_temp.check('profils créés à l''inscription',
  (select count(*) from public.profiles) = 6);

select pg_temp.check('le rôle envoyé à l''inscription est respecté',
  (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 'client');


-- =====================================================================
-- 2. Une boutique est en ligne dès sa création (0033)
-- =====================================================================
select pg_temp.check('une boutique creee est validee d''office',
  (select status from public.merchants where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'approved');
select pg_temp.check('sa date de mise en ligne est posee',
  (select approved_at is not null from public.merchants where id = 'aaaaaaaa-0000-0000-0000-000000000001'));

set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        1, 'Sac de riz importé 50kg', 450000, 'draft');

reset role;


-- =====================================================================
-- 3. Un commerçant ne peut pas s'auto-valider
-- =====================================================================
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

do $$
begin
  update public.merchants set status = 'approved'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'ECHEC un commerçant a pu s''auto-valider';
exception when insufficient_privilege then
  raise notice 'OK    auto-validation refusée (colonne non accordée)';
end $$;

reset role;


-- =====================================================================
-- 4. Pas de publication sans photo
-- =====================================================================
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

do $$
begin
  update public.products set status = 'active'
   where id = 'cccccccc-0000-0000-0000-000000000001';
  raise exception 'ECHEC publication acceptée sans photo';
exception when others then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    publication refusée sans photo';
end $$;

insert into public.product_images (product_id, storage_path, position)
values ('cccccccc-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001/p1/0.webp', 0);

update public.products set status = 'active'
 where id = 'cccccccc-0000-0000-0000-000000000001';
select pg_temp.check('publication acceptée avec photo et boutique validée',
  (select status from public.products where id = 'cccccccc-0000-0000-0000-000000000001') = 'active');


-- =====================================================================
-- 5. Maximum 5 photos, garanti par la structure (0026)
-- =====================================================================
-- La limite est passée de 3 à 5 avec 0026 sans que ce bloc suive : il
-- attendait le refus d'une 4e photo, que la base accepte désormais, et
-- toute la suite s'arrêtait ici, à la 8e vérification — les autres ne
-- tournaient plus.
insert into public.product_images (product_id, storage_path, position) values
  ('cccccccc-0000-0000-0000-000000000001', 'x/1.webp', 1),
  ('cccccccc-0000-0000-0000-000000000001', 'x/2.webp', 2),
  ('cccccccc-0000-0000-0000-000000000001', 'x/3.webp', 3),
  ('cccccccc-0000-0000-0000-000000000001', 'x/4.webp', 4);

do $$
begin
  insert into public.product_images (product_id, storage_path, position)
  values ('cccccccc-0000-0000-0000-000000000001', 'x/5.webp', 5);
  raise exception 'ECHEC une 6e photo a été acceptée';
exception when check_violation then
  raise notice 'OK    6e photo refusée par la contrainte';
end $$;

reset role;

-- Un second produit chez A, et un produit chez B, pour la suite des tests.
-- Noter l'ordre imposé par le trigger : brouillon, puis photo, puis
-- publication. Impossible de créer directement un produit publié sans
-- photo, même en administrateur — les triggers s'appliquent aussi à lui.
insert into public.products (id, merchant_id, category_id, title, price_gnf) values
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 'Téléphone Tecno', 850000),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 3, 'Chargeur', 25000);
insert into public.product_images (product_id, storage_path, position) values
  ('cccccccc-0000-0000-0000-000000000002', 'y/0.webp', 0),
  ('cccccccc-0000-0000-0000-000000000003', 'z/0.webp', 0);
update public.products set status = 'active'
 where id in ('cccccccc-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');


-- =====================================================================
-- 6. Un commerçant ne touche pas aux produits d'un autre
-- =====================================================================
set role authenticated;
select pg_temp.login('22222222-2222-2222-2222-222222222222');

select pg_temp.check('le produit d''autrui est visible dans le catalogue',
  (select count(*) from public.products
    where id = 'cccccccc-0000-0000-0000-000000000001') = 1);

-- Le RLS ne lève pas d'erreur : la ligne n'existe simplement pas pour cet
-- utilisateur. Zéro ligne modifiée.
with modif as (
  update public.products set title = 'Piraté'
   where id = 'cccccccc-0000-0000-0000-000000000001' returning 1
)
select pg_temp.check('modification du produit d''autrui bloquée',
  (select count(*) from modif) = 0);

reset role;


-- =====================================================================
-- 7. Un seul fil par couple (client, boutique)
-- =====================================================================
set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');   -- Client C

insert into public.conversations (id, client_id, merchant_id)
values ('dddddddd-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333',
        'aaaaaaaa-0000-0000-0000-000000000001');

do $$
begin
  insert into public.conversations (client_id, merchant_id)
  values ('33333333-3333-3333-3333-333333333333',
          'aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'ECHEC un second fil a été ouvert vers la même boutique';
exception when unique_violation then
  raise notice 'OK    un seul fil par couple (client, boutique)';
end $$;


-- =====================================================================
-- 8. Le premier message doit préciser le produit
-- =====================================================================
do $$
begin
  insert into public.messages (conversation_id, sender_id, body)
  values ('dddddddd-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333', 'Bonjour, c''est combien ?');
  raise exception 'ECHEC premier message accepté sans produit';
exception when others then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    premier message refusé sans produit référencé';
end $$;

insert into public.messages (conversation_id, sender_id, product_id, body)
values ('dddddddd-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333',
        'cccccccc-0000-0000-0000-000000000001',
        'Bonjour, le sac de riz est-il disponible ?');

-- La suite de l'échange n'a plus besoin de répéter le produit.
insert into public.messages (conversation_id, sender_id, body)
values ('dddddddd-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333', 'Et vous livrez ?');
select pg_temp.check('les messages suivants peuvent omettre le produit',
  (select count(*) from public.messages where product_id is null) = 1);

-- On peut changer de sujet dans le même fil : c'est tout l'intérêt.
insert into public.messages (conversation_id, sender_id, product_id, body)
values ('dddddddd-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333',
        'cccccccc-0000-0000-0000-000000000002',
        'Et le téléphone Tecno, il est neuf ?');
select pg_temp.check('un même fil couvre plusieurs produits',
  (select count(distinct product_id) from public.messages
    where conversation_id = 'dddddddd-0000-0000-0000-000000000001') = 2);


-- =====================================================================
-- 9. On ne référence pas le produit d'une autre boutique
-- =====================================================================
do $$
begin
  insert into public.messages (conversation_id, sender_id, product_id, body)
  values ('dddddddd-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          'cccccccc-0000-0000-0000-000000000003',   -- produit de la boutique B
          'Ce chargeur ?');
  raise exception 'ECHEC produit d''une autre boutique accepté';
exception when others then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    produit d''une autre boutique refusé';
end $$;

reset role;


-- =====================================================================
-- 10. Étanchéité des conversations privées
-- =====================================================================
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');   -- Commerçant A
select pg_temp.check('le commerçant destinataire voit le fil',
  (select count(*) from public.conversations) = 1);
-- Trois messages seulement : les deux tentatives refusées plus haut ont
-- été annulées par la base. Un refus ne laisse aucune trace partielle.
select pg_temp.check('le commerçant destinataire voit les messages',
  (select count(*) from public.messages) = 3);
select pg_temp.check('le commerçant voit le nom de son interlocuteur',
  (select full_name from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') = 'Client C');

reset role; set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');   -- Client D, étranger
select pg_temp.check('un tiers ne voit AUCUN fil',
  (select count(*) from public.conversations) = 0);
select pg_temp.check('un tiers ne voit AUCUN message',
  (select count(*) from public.messages) = 0);
select pg_temp.check('un tiers ne voit pas le nom des autres clients',
  (select count(*) from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') = 0);

reset role; set role authenticated;
select pg_temp.login('22222222-2222-2222-2222-222222222222');   -- Concurrent
select pg_temp.check('un commerçant concurrent ne voit AUCUN message',
  (select count(*) from public.messages) = 0);

reset role;


-- =====================================================================
-- 11. On ne réécrit pas le message d'autrui
-- =====================================================================
-- Le commerçant a le droit de marquer comme lus les messages reçus. Sans
-- liste blanche de colonnes, ce même droit lui permettrait de falsifier
-- leur contenu.
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

do $$
begin
  update public.messages set body = 'Je m''engage à payer le double'
   where sender_id = '33333333-3333-3333-3333-333333333333';
  raise exception 'ECHEC un participant a pu falsifier le message de l''autre';
exception when insufficient_privilege then
  raise notice 'OK    falsification du message d''autrui refusée';
end $$;

update public.messages set read_at = now()
 where sender_id = '33333333-3333-3333-3333-333333333333';
select pg_temp.check('marquage « lu » autorisé',
  (select count(*) from public.messages where read_at is not null) = 3);

reset role;


-- =====================================================================
-- 12. Un commerçant ne peut pas ouvrir de fil (rôle unique)
-- =====================================================================
set role authenticated;
select pg_temp.login('22222222-2222-2222-2222-222222222222');

do $$
begin
  insert into public.conversations (client_id, merchant_id)
  values ('22222222-2222-2222-2222-222222222222',
          'aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'ECHEC un commerçant a pu ouvrir un fil';
exception when insufficient_privilege then
  raise notice 'OK    ouverture de fil refusée à un commerçant';
end $$;

reset role;


-- =====================================================================
-- 13. Un compte suspendu ne peut plus écrire
-- =====================================================================
update public.profiles set is_suspended = true
 where id = '33333333-3333-3333-3333-333333333333';

set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');

do $$
begin
  insert into public.messages (conversation_id, sender_id, product_id, body)
  values ('dddddddd-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          'cccccccc-0000-0000-0000-000000000001', 'Encore moi');
  raise exception 'ECHEC un compte suspendu a pu écrire';
exception when insufficient_privilege then
  raise notice 'OK    écriture refusée à un compte suspendu';
end $$;

reset role;
update public.profiles set is_suspended = false
 where id = '33333333-3333-3333-3333-333333333333';


-- =====================================================================
-- 14. Le compteur de popularité compte des CLIENTS, pas des messages
-- =====================================================================
-- Le client C a envoyé deux messages sur le sac de riz : le compteur doit
-- valoir 1, sinon un client bavard fait grimper un produit tout seul.
select pg_temp.check('un client bavard ne compte qu''une fois',
  (select contact_count from public.products
    where id = 'cccccccc-0000-0000-0000-000000000001') = 1);

set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');
insert into public.conversations (id, client_id, merchant_id)
values ('dddddddd-0000-0000-0000-000000000002',
        '44444444-4444-4444-4444-444444444444',
        'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.messages (conversation_id, sender_id, product_id, body)
values ('dddddddd-0000-0000-0000-000000000002',
        '44444444-4444-4444-4444-444444444444',
        'cccccccc-0000-0000-0000-000000000001', 'Toujours dispo ?');
reset role;

select pg_temp.check('un second client fait bien monter le compteur',
  (select contact_count from public.products
    where id = 'cccccccc-0000-0000-0000-000000000001') = 2);


-- =====================================================================
-- 15. Les deux limites anti-spam
-- =====================================================================
-- (a) nombre de boutiques contactées par jour
insert into auth.users (id, email, raw_user_meta_data)
select gen_random_uuid(), 'spam' || i || '@test.gn',
       '{"role":"merchant","full_name":"Boutique","phone":"620"}'::jsonb
  from generate_series(1, 30) i;

insert into public.merchants (profile_id, shop_name, city_id, status)
select p.id, 'Boutique ' || p.id, 1, 'approved'
  from public.profiles p
 where p.role = 'merchant'
   and p.id not in ('11111111-1111-1111-1111-111111111111',
                    '22222222-2222-2222-2222-222222222222');

do $$
declare m record; n int := 0;
begin
  for m in select id from public.merchants loop
    begin
      insert into public.conversations (client_id, merchant_id)
      values ('55555555-5555-5555-5555-555555555555', m.id);
      n := n + 1;
    exception
      when unique_violation then null;   -- fil déjà existant, on passe
      when others then
        raise notice 'OK    limite de contacts déclenchée après % boutiques', n;
        return;
    end;
  end loop;
  raise exception 'ECHEC limite de contacts jamais déclenchée (% fils)', n;
end $$;

-- (b) nombre de messages par jour, tous fils confondus
do $$
declare conv uuid; n int := 0;
begin
  insert into public.conversations (client_id, merchant_id)
  values ('66666666-6666-6666-6666-666666666666',
          'aaaaaaaa-0000-0000-0000-000000000001')
  returning id into conv;

  for i in 1..120 loop
    begin
      insert into public.messages (conversation_id, sender_id, product_id, body)
      values (conv, '66666666-6666-6666-6666-666666666666',
              'cccccccc-0000-0000-0000-000000000002', 'message ' || i);
      n := n + 1;
    exception when others then
      raise notice 'OK    limite de messages déclenchée après %', n;
      return;
    end;
  end loop;
  raise exception 'ECHEC limite de messages jamais déclenchée (% messages)', n;
end $$;


-- =====================================================================
-- 16. Recherche
-- =====================================================================
-- Le titre contient « importé ». On le cherche sans accent et en
-- majuscules : c'est ce que tapera un client sur un clavier de téléphone.
select pg_temp.check('recherche sans accent trouve le produit accentué',
  (select count(*) from public.search_products('IMPORTE')) = 1);

select pg_temp.check('recherche avec accent trouve aussi',
  (select count(*) from public.search_products('importé')) = 1);

select pg_temp.check('recherche par nom de boutique',
  (select count(*) from public.search_products('chez a')) = 2);

select pg_temp.check('filtre par ville sans résultat hors zone',
  (select count(*) from public.search_products(null, 4)) = 0);

select pg_temp.check('les brouillons n''apparaissent jamais',
  (select count(*) from public.search_products()) = 3);


-- =====================================================================
-- 17. Blocage entre personnes (écran 32)
-- =====================================================================
-- Fil Client D <-> Boutique A, ouvert section 14, encore intact.
set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');   -- Client D

do $$
begin
  update public.conversations set blocked_by = '11111111-1111-1111-1111-111111111111'
   where id = 'dddddddd-0000-0000-0000-000000000002';
  raise exception 'ECHEC Client D a pu désigner Boutique A comme bloqueuse';
exception when insufficient_privilege then
  raise notice 'OK    impossible de désigner l''AUTRE participant comme bloqueur';
end $$;

reset role;
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');   -- Boutique A

update public.conversations set blocked_by = '11111111-1111-1111-1111-111111111111'
 where id = 'dddddddd-0000-0000-0000-000000000002';
select pg_temp.check('un participant peut se désigner lui-même comme bloqueur',
  (select blocked_by from public.conversations
    where id = 'dddddddd-0000-0000-0000-000000000002') = '11111111-1111-1111-1111-111111111111');

-- Boutique A a bloqué : le fil est fermé pour elle aussi (0032). Écrire à
-- quelqu'un qui ne peut pas répondre n'est pas un service rendu.
do $$
begin
  insert into public.messages (conversation_id, sender_id, product_id, body)
  values ('dddddddd-0000-0000-0000-000000000002',
          '11111111-1111-1111-1111-111111111111',
          'cccccccc-0000-0000-0000-000000000001', 'Dernier mot du bloqueur');
  raise exception 'ECHEC le bloqueur a pu écrire dans un fil qu''il a bloqué';
exception when insufficient_privilege then
  raise notice 'OK    écriture refusée au bloqueur aussi';
end $$;
reset role;

-- Client D, bloqué, ne peut plus écrire...
set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');   -- Client D

do $$
begin
  insert into public.messages (conversation_id, sender_id, product_id, body)
  values ('dddddddd-0000-0000-0000-000000000002',
          '44444444-4444-4444-4444-444444444444',
          'cccccccc-0000-0000-0000-000000000001', 'Vous êtes là ?');
  raise exception 'ECHEC la personne bloquée a pu écrire';
exception when insufficient_privilege then
  raise notice 'OK    écriture refusée à la personne bloquée, le fil reste lisible';
end $$;

-- ...ni lever le blocage d'un autre, ni s'y substituer (le « contre-
-- blocage » que 0002 laissait passer). Le RLS écarte la ligne : zéro
-- ligne modifiée, sans erreur.
with leve as (
  update public.conversations set blocked_by = null
   where id = 'dddddddd-0000-0000-0000-000000000002' returning 1
)
select pg_temp.check('la personne bloquée ne peut pas débloquer', (select count(*) from leve) = 0);

with contre as (
  update public.conversations set blocked_by = '44444444-4444-4444-4444-444444444444'
   where id = 'dddddddd-0000-0000-0000-000000000002' returning 1
)
select pg_temp.check('la personne bloquée ne peut pas contre-bloquer', (select count(*) from contre) = 0);

reset role;

-- Le bloqueur, lui, débloque, et le fil se rouvre dans les deux sens.
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');   -- Boutique A

update public.conversations set blocked_by = null
 where id = 'dddddddd-0000-0000-0000-000000000002';
select pg_temp.check('le bloqueur peut débloquer',
  (select blocked_by from public.conversations
    where id = 'dddddddd-0000-0000-0000-000000000002') is null);

insert into public.messages (conversation_id, sender_id, product_id, body)
values ('dddddddd-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'cccccccc-0000-0000-0000-000000000001', 'On reprend');
reset role;

set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');   -- Client D
insert into public.messages (conversation_id, sender_id, product_id, body)
values ('dddddddd-0000-0000-0000-000000000002',
        '44444444-4444-4444-4444-444444444444',
        'cccccccc-0000-0000-0000-000000000001', 'Merci');
select pg_temp.check('après déblocage, les deux écrivent de nouveau', true);

reset role;


-- =====================================================================
-- 18. Un compte supprimé (anonymisé) ne peut plus écrire
-- =====================================================================
-- Même mécanisme que la section 13 (compte suspendu) : `is_active_user()`
-- vérifie maintenant les deux colonnes. Un seul endroit changé suffit.
update public.profiles set is_deleted = true
 where id = '33333333-3333-3333-3333-333333333333';

set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');   -- Client C

do $$
begin
  insert into public.messages (conversation_id, sender_id, product_id, body)
  values ('dddddddd-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          'cccccccc-0000-0000-0000-000000000001', 'Encore moi');
  raise exception 'ECHEC un compte supprimé a pu écrire';
exception when insufficient_privilege then
  raise notice 'OK    écriture refusée à un compte supprimé';
end $$;

reset role;
update public.profiles set is_deleted = false
 where id = '33333333-3333-3333-3333-333333333333';

-- Le point de toute cette section : les messages de Client C restent lus
-- normalement par Boutique A, anonymisation oblige — rien n'a cascadé.
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');   -- Boutique A
select pg_temp.check('les messages du compte supprimé restent lisibles par l''autre partie',
  (select count(*) from public.messages
    where conversation_id = 'dddddddd-0000-0000-0000-000000000001') > 0);
reset role;


-- =====================================================================
-- 19. Comptes liés : un second profil sur la même connexion
-- =====================================================================
set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');   -- Client C, un seul compte pour l'instant

insert into public.profiles (auth_user_id, role, full_name, phone)
values ('33333333-3333-3333-3333-333333333333', 'merchant', 'Boutique de Mariama', '620000099');

select pg_temp.check('un second compte lié est créé sur la même connexion',
  (select count(*) from public.profiles
    where auth_user_id = '33333333-3333-3333-3333-333333333333') = 2);

select pg_temp.check('my_profile_id retrouve le bon profil selon le rôle demandé',
  (select role from public.profiles where id = public.my_profile_id('merchant')) = 'merchant');

-- Un seul profil par rôle et par connexion : la contrainte `unique`, pas
-- une policy — inutile de dupliquer la même règle à deux endroits.
do $$
begin
  insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('33333333-3333-3333-3333-333333333333', 'client', 'Mariama bis', '620000003');
  raise exception 'ECHEC un second profil du même rôle a été créé sur la même connexion';
exception when unique_violation then
  raise notice 'OK    un seul profil par rôle et par connexion';
end $$;

-- Créer un profil pour la connexion d'un AUTRE, en revanche, doit échouer :
-- ce n'est pas une histoire de rôle déjà pris, mais d'identité.
do $$
begin
  insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('44444444-4444-4444-4444-444444444444', 'merchant', 'Usurpation', '620000000');
  raise exception 'ECHEC un profil a pu être créé pour la connexion de quelqu''un d''autre';
exception when insufficient_privilege then
  raise notice 'OK    impossible de créer un profil pour une autre connexion';
end $$;

reset role;


-- =====================================================================
-- 20. Catalogue public : un visiteur non connecté voit les produits
-- vendus (grisés côté écran), jamais les brouillons
-- =====================================================================
-- Piège trouvé en branchant l'écran d'accueil sur la vraie base : la
-- policy « products: catalogue public » ne laissait passer que 'active'.
-- Un produit marqué 'sold' — que les écrans 8 et « boutique publique »
-- affichent grisé depuis le début — devenait invisible même à un
-- acheteur légitime. `set role anon` ici, sans connexion : c'est
-- délibéré, c'est le rôle qu'utilise un visiteur qui n'a jamais tapé de
-- mot de passe.
update public.products set status = 'sold' where id = 'cccccccc-0000-0000-0000-000000000003';

set role anon;
select pg_temp.check('un visiteur non connecté voit un produit vendu',
  (select count(*) from public.products
    where id = 'cccccccc-0000-0000-0000-000000000003' and status = 'sold') = 1);
reset role;

update public.products set status = 'active' where id = 'cccccccc-0000-0000-0000-000000000003';

-- À l'inverse, un brouillon fraîchement créé reste invisible pour ce même
-- visiteur — un produit précis, pas juste « aucun brouillon nulle part »,
-- qui serait vrai même si la policy avait un trou.
insert into public.products (id, merchant_id, category_id, title, price_gnf)
values ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 'Brouillon test', 10000);

set role anon;
select pg_temp.check('un visiteur non connecté ne voit pas un brouillon précis',
  (select count(*) from public.products where id = 'cccccccc-0000-0000-0000-000000000004') = 0);
reset role;

-- =====================================================================
-- 21. Un produit publié garde au moins une photo
-- =====================================================================
-- `products_check_publishable` (0002) refuse la publication d'un produit
-- sans photo, mais il est posé sur `products` : il ne voit pas les photos
-- partir par l'autre table. Le code applicatif passe justement par là —
-- `updateProductAction` remplace la liste des photos par un `delete` de
-- toutes les lignes suivi d'un `insert`. Un produit actif pouvait donc se
-- retrouver dans le catalogue public sans aucune vignette.
--
-- Ces trois vérifications sont ce qui empêche 0011 de redevenir
-- décoratif : elles testent l'invariant (« publié ⇒ au moins une
-- photo »), pas l'implémentation du trigger.
insert into public.products (id, merchant_id, category_id, title, price_gnf)
values ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 'Produit deux photos', 90000);

insert into public.product_images (product_id, storage_path, position) values
  ('cccccccc-0000-0000-0000-000000000005', 'p5/a.webp', 0),
  ('cccccccc-0000-0000-0000-000000000005', 'p5/b.webp', 1);

update public.products set status = 'active' where id = 'cccccccc-0000-0000-0000-000000000005';

-- Retirer UNE photo sur deux ne dépublie rien : il en reste une.
delete from public.product_images
 where product_id = 'cccccccc-0000-0000-0000-000000000005' and storage_path = 'p5/b.webp';

select pg_temp.check('retirer une photo sur deux laisse le produit publié',
  (select status from public.products where id = 'cccccccc-0000-0000-0000-000000000005') = 'active');

-- Retirer la DERNIÈRE le dépublie. Un brouillon est récupérable par son
-- commerçant ; une vignette vide dans le fil public, non.
delete from public.product_images where product_id = 'cccccccc-0000-0000-0000-000000000005';

select pg_temp.check('retirer la derniere photo repasse le produit en brouillon',
  (select status from public.products where id = 'cccccccc-0000-0000-0000-000000000005') = 'draft');

-- Et la suppression d'un produit ne doit pas échouer à cause de ce
-- trigger : ses photos partent en cascade, donc il se déclenche là aussi,
-- sur une ligne `products` en cours de suppression.
insert into public.product_images (product_id, storage_path, position)
values ('cccccccc-0000-0000-0000-000000000005', 'p5/c.webp', 0);
update public.products set status = 'active' where id = 'cccccccc-0000-0000-0000-000000000005';
delete from public.products where id = 'cccccccc-0000-0000-0000-000000000005';

select pg_temp.check('supprimer un produit publie reste possible (cascade des photos)',
  (select count(*) from public.products where id = 'cccccccc-0000-0000-0000-000000000005') = 0);


-- =====================================================================
-- 22. Plus aucun chemin ne sort une boutique de la vitrine, hors suspension
-- =====================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'g@test.gn',
   '{"role":"merchant","full_name":"Boutique G","phone":"620000007"}');

insert into public.merchants (profile_id, shop_name, city_id)
  select id, 'Boutique G', 1 from public.profiles where full_name = 'Boutique G';

select pg_temp.check('la boutique G est en ligne des sa creation',
  (select status from public.merchants where shop_name = 'Boutique G') = 'approved');

do $$
begin
  update public.merchants set status = 'pending' where shop_name = 'Boutique G';
  raise exception 'ECHEC une boutique a pu repasser en attente';
exception when check_violation then
  raise notice 'OK    une boutique ne repasse pas en attente';
end $$;

select pg_temp.login('77777777-7777-7777-7777-777777777777');
set role authenticated;

do $$
begin
  update public.merchants set status = 'pending' where shop_name = 'Boutique G';
  raise exception 'ECHEC un commerçant a écrit son propre status';
exception when insufficient_privilege then
  raise notice 'OK    un commercant ne peut pas ecrire son propre status';
end $$;

reset role;


-- =====================================================================
-- 23. Une boutique suspendue quitte la vitrine (0013)
-- =====================================================================
-- La suspension vit sur `profiles.is_suspended`, la visibilité sur
-- `merchants.status` : rien ne reliait les deux, et un commerçant
-- suspendu gardait boutique, produits et bouton « Contacter ». Le pire
-- n'était pas qu'il reste visible, c'est qu'on pouvait lui ÉCRIRE sans
-- qu'il puisse jamais répondre.

-- En brouillon d'abord : `check_product_publishable` (0011) refuse de
-- publier un produit sans photo, et c'est exactement ce qu'il doit faire.
insert into public.products (merchant_id, category_id, title, price_gnf, status)
  select id, 1, 'Produit vitrine G', 50000, 'draft'
    from public.merchants where shop_name = 'Boutique G';
insert into public.product_images (product_id, storage_path, position)
  select id, 'g/photo.webp', 0 from public.products where title = 'Produit vitrine G';
update public.products set status = 'active' where title = 'Produit vitrine G';

-- D'abord la référence : tout est bien public tant que rien n'est suspendu.
reset role;
select pg_temp.login(null);
set role anon;
select pg_temp.check('avant suspension, la boutique est publique',
  (select count(*) from public.merchants where shop_name = 'Boutique G') = 1);
select pg_temp.check('avant suspension, son produit est au catalogue',
  (select count(*) from public.products where title = 'Produit vitrine G') = 1);

-- On suspend le PROFIL, sans toucher à `merchants.status`.
reset role;
update public.profiles set is_suspended = true where full_name = 'Boutique G';

select pg_temp.login(null);
set role anon;
select pg_temp.check('une boutique suspendue disparait de la vitrine',
  (select count(*) from public.merchants where shop_name = 'Boutique G') = 0);
select pg_temp.check('ses produits quittent le catalogue public',
  (select count(*) from public.products where title = 'Produit vitrine G') = 0);

-- Et surtout : on ne peut plus lui écrire.
reset role;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
declare mid uuid;
begin
  select id into mid from public.merchants where shop_name = 'Boutique G';
  insert into public.conversations (client_id, merchant_id)
    values (public.my_profile_id('client'), mid);
  raise exception 'ECHEC un client a ouvert un fil avec un commerçant suspendu';
exception when insufficient_privilege then
  raise notice 'OK    on ne peut pas ecrire a un commercant suspendu';
end $$;

-- La réversibilité compte autant : lever la suspension remet en vitrine.
reset role;
update public.profiles set is_suspended = false where full_name = 'Boutique G';
select pg_temp.login(null);
set role anon;
select pg_temp.check('lever la suspension remet la boutique en vitrine',
  (select count(*) from public.merchants where shop_name = 'Boutique G') = 1);
reset role;


-- =====================================================================
-- 24. Une conversation survit à la suspension de la boutique (0016)
-- =====================================================================
-- Le pendant du test 23 : celui-ci vérifie ce que la suspension NE doit
-- PAS emporter. 23 prouve qu'un commerçant suspendu quitte la vitrine,
-- 24 prouve qu'il ne disparaît pas des fils déjà ouverts — sinon le
-- client perd l'accès à son propre historique, et `/messages/[id]`
-- répond « page introuvable » pour une conversation qui est la sienne.

reset role;
update public.profiles set is_suspended = false where full_name = 'Boutique G';

-- Le client D ouvre un fil avec la Boutique G, tant qu'elle est en ligne.
select pg_temp.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
insert into public.conversations (client_id, merchant_id)
  select '44444444-4444-4444-4444-444444444444', id
    from public.merchants where shop_name = 'Boutique G';
insert into public.messages (conversation_id, sender_id, product_id, body)
  select c.id, '44444444-4444-4444-4444-444444444444', p.id, 'Bonjour, c''est disponible ?'
    from public.conversations c, public.products p
   where c.client_id = '44444444-4444-4444-4444-444444444444'
     and p.title = 'Produit vitrine G'
     and c.merchant_id = p.merchant_id;

-- La boutique est suspendue APRÈS coup.
reset role;
update public.profiles set is_suspended = true where full_name = 'Boutique G';

select pg_temp.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
-- Compté sur CETTE boutique précisément : le client D a d'autres fils
-- ouverts par les tests précédents, et un total ne prouverait rien.
select pg_temp.check('mon fil avec une boutique suspendue reste lisible',
  (select count(*) from public.conversations c
     join public.merchants m on m.id = c.merchant_id
    where c.client_id = '44444444-4444-4444-4444-444444444444'
      and m.shop_name = 'Boutique G') = 1);
-- C'est CE point qui manquait : sans lui, la jointure `merchants(...)`
-- de `getThreadContext` revient vide et le fil devient un 404.
select pg_temp.check('la boutique de mon fil reste lisible malgre la suspension',
  (select count(*) from public.merchants where shop_name = 'Boutique G') = 1);
select pg_temp.check('ses produits, eux, restent hors du catalogue',
  (select count(*) from public.products where title = 'Produit vitrine G') = 0);
reset role;

-- Et la boutique ne devient pas lisible pour autant par qui n'a jamais
-- parlé avec elle : la nouvelle branche est une porte, pas une brèche.
select pg_temp.login('33333333-3333-3333-3333-333333333333');
set role authenticated;
select pg_temp.check('un client sans fil ne voit toujours pas la boutique suspendue',
  (select count(*) from public.merchants where shop_name = 'Boutique G') = 0);
reset role;
select pg_temp.login(null);
set role anon;
select pg_temp.check('un visiteur anonyme ne voit toujours pas la boutique suspendue',
  (select count(*) from public.merchants where shop_name = 'Boutique G') = 0);
reset role;
update public.profiles set is_suspended = false where full_name = 'Boutique G';


-- =====================================================================
-- 25. On ne contacte pas sa propre boutique (0016)
-- =====================================================================
-- Le commerçant A possède aussi un compte client lié (test 19). Rien ne
-- l'empêchait d'ouvrir un fil avec SA boutique : le fil avait la même
-- personne des deux côtés, et surtout `bump_contact_count` incrémentait
-- le compteur qui sert au tri « populaires ». Un vendeur pouvait donc
-- faire monter ses propres produits en s'écrivant à lui-même.

reset role;
update public.profiles set is_suspended = false
 where id = '11111111-1111-1111-1111-111111111111';

select pg_temp.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
begin
  insert into public.conversations (client_id, merchant_id)
    values (public.my_profile_id('client'), public.my_merchant_id());
  raise exception 'ECHEC un commercant a ouvert un fil avec sa propre boutique';
exception when insufficient_privilege then
  raise notice 'OK    on ne peut pas contacter sa propre boutique';
end $$;
reset role;

-- Le refus ne doit pas déborder sur le cas normal : un client qui n'a
-- aucune boutique reste libre de contacter n'importe quel commerçant.
-- (`merchant_id <> my_merchant_id()` vaut NULL quand la personne n'a pas
-- de boutique — d'où le `is null or` de la policy, que ce test protège.)
-- Le client D, et non E : E a épuisé son quota de 20 conversations dans
-- les tests de limite, et son refus n'aurait rien prouvé ici.
select pg_temp.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
-- Le fil créé n'est pas effacé ensuite : `delete` est révoqué sur
-- `conversations` (0002, partie 4), et c'est très bien ainsi.
do $$
declare v_id uuid;
begin
  insert into public.conversations (client_id, merchant_id)
    select '44444444-4444-4444-4444-444444444444', id
      from public.merchants where shop_name = 'Chez B'
  returning id into v_id;
  raise notice 'OK    un client sans boutique contacte toujours un fil (%)', v_id;
exception when others then
  raise exception 'ECHEC un client sans boutique ne peut plus contacter personne : %', sqlerrm;
end $$;
reset role;


-- =====================================================================
-- 26. Une boutique suspendue met ses fils en lecture seule (0017)
-- =====================================================================
-- Décision du 2026-09-15 : la suspension gèle l'écriture des DEUX côtés
-- et ne supprime rien. Ces vérifications sont la preuve des deux
-- moitiés — celle qui ferme, et celle qui doit rester ouverte.
-- Le test 24 a déjà prouvé que le fil reste LISIBLE ; celui-ci prouve
-- qu'il n'accepte plus d'écriture, et que l'historique ne bouge pas.

reset role;
update public.profiles set is_suspended = false where full_name = 'Boutique G';

-- (a) Boutique ACTIVE : lecture ET écriture, le cas normal d'abord —
--     sans lui, un gel généralisé passerait pour un succès.
select pg_temp.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
select pg_temp.check('boutique active : le fil accepte l''ecriture',
  public.conversation_is_open(
    (select c.id from public.conversations c
       join public.merchants m on m.id = c.merchant_id
      where c.client_id = '44444444-4444-4444-4444-444444444444'
        and m.shop_name = 'Boutique G')));
insert into public.messages (conversation_id, sender_id, body)
  select c.id, '44444444-4444-4444-4444-444444444444', 'Toujours dispo ?'
    from public.conversations c
    join public.merchants m on m.id = c.merchant_id
   where c.client_id = '44444444-4444-4444-4444-444444444444'
     and m.shop_name = 'Boutique G';
select pg_temp.check('boutique active : le message du client est passe',
  (select count(*) from public.messages m
     join public.conversations c on c.id = m.conversation_id
     join public.merchants mm on mm.id = c.merchant_id
    where mm.shop_name = 'Boutique G') = 2);
reset role;

-- On suspend, et RIEN d'autre : aucun effacement, aucun changement de
-- `merchants.status`.
update public.profiles set is_suspended = true where full_name = 'Boutique G';

-- (b) Le CLIENT ne peut plus écrire.
select pg_temp.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
select pg_temp.check('boutique suspendue : le fil est ferme a l''ecriture',
  not public.conversation_is_open(
    (select c.id from public.conversations c
       join public.merchants m on m.id = c.merchant_id
      where c.client_id = '44444444-4444-4444-4444-444444444444'
        and m.shop_name = 'Boutique G')));
do $$
declare v_conv uuid;
begin
  select c.id into v_conv from public.conversations c
    join public.merchants m on m.id = c.merchant_id
   where c.client_id = '44444444-4444-4444-4444-444444444444'
     and m.shop_name = 'Boutique G';
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '44444444-4444-4444-4444-444444444444', 'Vous etes la ?');
  raise exception 'ECHEC un client a ecrit a une boutique suspendue';
exception when insufficient_privilege then
  raise notice 'OK    un client n''ecrit plus a une boutique suspendue';
end $$;

-- (c) Et la LECTURE, elle, ne bouge pas : c'est une lecture seule, pas
--     une suppression. Deux messages écrits, deux messages toujours là.
select pg_temp.check('boutique suspendue : l''historique reste lisible',
  (select count(*) from public.messages m
     join public.conversations c on c.id = m.conversation_id
     join public.merchants mm on mm.id = c.merchant_id
    where mm.shop_name = 'Boutique G') = 2);
select pg_temp.check('boutique suspendue : le fil lui-meme reste lisible',
  (select count(*) from public.conversations c
     join public.merchants m on m.id = c.merchant_id
    where c.client_id = '44444444-4444-4444-4444-444444444444'
      and m.shop_name = 'Boutique G') = 1);
reset role;

-- (d) Le COMMERÇANT suspendu ne répond pas non plus. Déjà refusé par
--     `is_active_profile` avant 0017 : ce test fige cette garantie, pour
--     qu'une réécriture de la policy d'envoi ne la perde pas en chemin.
select pg_temp.login('77777777-7777-7777-7777-777777777777');
set role authenticated;
do $$
declare v_conv uuid;
begin
  select c.id into v_conv from public.conversations c
    join public.merchants m on m.id = c.merchant_id
   where m.shop_name = 'Boutique G'
     and c.client_id = '44444444-4444-4444-4444-444444444444';
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, '77777777-7777-7777-7777-777777777777', 'Oui, bonjour');
  raise exception 'ECHEC un commercant suspendu a repondu';
exception when insufficient_privilege then
  raise notice 'OK    un commercant suspendu ne repond pas dans ses fils';
end $$;
reset role;

-- (e) La réversibilité, comme au test 23 : lever la suspension rouvre
--     l'écriture. Un gel qui ne se lève pas serait une suppression
--     déguisée.
update public.profiles set is_suspended = false where full_name = 'Boutique G';
select pg_temp.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
insert into public.messages (conversation_id, sender_id, body)
  select c.id, '44444444-4444-4444-4444-444444444444', 'Rebonjour'
    from public.conversations c
    join public.merchants m on m.id = c.merchant_id
   where c.client_id = '44444444-4444-4444-4444-444444444444'
     and m.shop_name = 'Boutique G';
select pg_temp.check('lever la suspension rouvre l''ecriture du fil',
  (select count(*) from public.messages m
     join public.conversations c on c.id = m.conversation_id
     join public.merchants mm on mm.id = c.merchant_id
    where mm.shop_name = 'Boutique G') = 3);
reset role;

-- (g) `conversation_is_open` ne répond qu'aux participants. Ce test
--     existe parce que la première version de la fonction échouait ici :
--     elle ne regardait que l'état de la boutique, et un tiers à qui le
--     RLS refuse le fil, ses messages et jusqu'à la boutique obtenait
--     quand même `true` en l'appelant avec l'identifiant du fil.
--     `security definer` rouvrait ainsi ce que trois policies fermaient.
--     Un identifiant difficile à deviner n'est pas une protection : il
--     circule dans les URL, les journaux et les captures d'écran.
--     Pour un tiers, la réponse est `false` — indistinguable d'un fil
--     gelé, donc sans rien à apprendre en la sondant.
select pg_temp.login('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pg_temp.check('conversation_is_open est muette pour un tiers',
  not public.conversation_is_open(
    (select c.id from public.conversations c
       join public.merchants m on m.id = c.merchant_id
      where c.client_id = '44444444-4444-4444-4444-444444444444'
        and m.shop_name = 'Boutique G')));
reset role;

-- Et un visiteur non connecté n'a pas même le droit de poser la
-- question : `execute` lui est révoqué (0017).
select pg_temp.login(null);
set role anon;
do $$
begin
  perform public.conversation_is_open('00000000-0000-0000-0000-000000000000');
  raise exception 'ECHEC un anonyme a appele conversation_is_open';
exception when insufficient_privilege then
  raise notice 'OK    un anonyme ne peut pas appeler conversation_is_open';
end $$;
reset role;



-- =====================================================================
-- 27. Le quota de 20 boutiques par jour refuse VRAIMENT (0002, 3.4)
-- =====================================================================
-- Le quota était déjà testé plus haut (section des limites) ; ce qui ne
-- l'était pas, c'est ce que l'application en fait. Deux garanties
-- comptent pour l'écran 16 : le refus porte le code P0001 — celui que
-- `findOrCreateConversation` reconnaît pour afficher une explication au
-- lieu de « Vérifiez votre connexion » — et AUCUNE conversation n'est
-- créée, le trigger s'exécutant avant l'insertion.

reset role;
-- Le client E a déjà épuisé ses 20 fils dans les tests de limite.
select pg_temp.check('le client E est bien au plafond',
  (select count(*) from public.conversations
    where client_id = '55555555-5555-5555-5555-555555555555'
      and created_at > now() - interval '1 day') >= 20);

select pg_temp.login('55555555-5555-5555-5555-555555555555');
set role authenticated;
do $$
declare
  v_avant int;
  v_apres int;
begin
  select count(*) into v_avant from public.conversations;
  begin
    insert into public.conversations (client_id, merchant_id)
      select '55555555-5555-5555-5555-555555555555', id
        from public.merchants where shop_name = 'Boutique G';
    raise exception 'ECHEC le quota de 20 conversations n''a pas arrete l''insertion';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
    -- P0001 : le code que l'application reconnaît. S'il changeait, le
    -- message d'explication redeviendrait « Vérifiez votre connexion ».
    if sqlstate <> 'P0001' then
      raise exception 'ECHEC le refus de quota ne porte plus le code P0001 mais % ', sqlstate;
    end if;
    raise notice 'OK    quota atteint : refus P0001, message « % »', sqlerrm;
  end;
  select count(*) into v_apres from public.conversations;
  if v_avant <> v_apres then
    raise exception 'ECHEC une conversation a ete creee malgre le quota';
  end if;
  raise notice 'OK    quota atteint : aucune conversation supplementaire creee';
end $$;
reset role;

-- Et sous le quota, rien ne change : le client C n'a qu'un fil ouvert.
select pg_temp.login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  insert into public.conversations (client_id, merchant_id)
    select '33333333-3333-3333-3333-333333333333', id
      from public.merchants where shop_name = 'Boutique G';
  raise notice 'OK    sous le quota, ouvrir un fil reste possible';
exception when others then
  raise exception 'ECHEC un client sous le quota ne peut plus ouvrir de fil : %', sqlerrm;
end $$;
reset role;


-- =====================================================================
-- 28. « Vendu » ne contourne pas le contrôle de publication (0018)
-- =====================================================================
-- La faille, en une phrase : la policy « products: catalogue public »
-- publie `status in ('active', 'sold')`, mais le trigger
-- `products_check_publishable` ne regardait que 'active'. Un commerçant
-- a le droit d'écrire `status` sur ses propres produits — il lui
-- suffisait donc d'un PATCH direct sur PostgREST pour faire passer un
-- brouillon sans photo à 'sold' et le poser au catalogue, en sautant les
-- deux conditions de publication.

reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('88880000-0000-0000-0000-000000000003', 'approved@test.gn', '{"role":"merchant","full_name":"Boutique V","phone":"620000103"}');

update public.profiles set id = auth_user_id
 where auth_user_id = '88880000-0000-0000-0000-000000000003';

insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('88881111-0000-0000-0000-000000000003', '88880000-0000-0000-0000-000000000003', 'Boutique V', 1);

insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('88882222-0000-0000-0000-000000000003', '88881111-0000-0000-0000-000000000003', 1, 'Brouillon chez V', 50000, 'draft'),
  ('88882222-0000-0000-0000-000000000004', '88881111-0000-0000-0000-000000000003', 1, 'Second chez V',    50000, 'draft'),
  ('88882222-0000-0000-0000-000000000005', '88881111-0000-0000-0000-000000000003', 1, 'Sans photo chez V', 50000, 'draft');

insert into public.product_images (product_id, storage_path, position) values
  ('88882222-0000-0000-0000-000000000003', 'v/1.jpg', 0),
  ('88882222-0000-0000-0000-000000000004', 'v/2.jpg', 0);

-- Un refus attendu : la transition doit lever une exception ET laisser le
-- produit là où il était. Vérifier le seul message ne suffirait pas —
-- c'est le statut en base qui décide de ce que le public voit.
create or replace function pg_temp.refus_attendu(label text, pid uuid, cible public.product_status)
returns void language plpgsql as $$
declare
  v_avant public.product_status;
  v_apres public.product_status;
begin
  select status into v_avant from public.products where id = pid;
  begin
    execute format('update public.products set status = %L where id = %L', cible, pid);
    raise exception 'ECHEC % : la transition a été ACCEPTÉE', label;
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
    raise notice 'OK    % (refus : %)', label, sqlerrm;
  end;
  select status into v_apres from public.products where id = pid;
  if v_apres is distinct from v_avant then
    raise exception 'ECHEC % : le statut a changé malgré le refus (% → %)', label, v_avant, v_apres;
  end if;
end $$;

create or replace function pg_temp.transition_attendue(label text, pid uuid, cible public.product_status)
returns void language plpgsql as $$
begin
  execute format('update public.products set status = %L where id = %L', cible, pid);
  if (select status from public.products where id = pid) <> cible then
    raise exception 'ECHEC % : aucune ligne touchée (RLS ?)', label;
  end if;
  raise notice 'OK    %', label;
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise exception 'ECHEC % : transition refusée alors qu''elle est légitime (%)', label, sqlerrm;
end $$;

-- --- 5, 6, 7 : boutique validée --------------------------------------
select pg_temp.login('88880000-0000-0000-0000-000000000003');
set role authenticated;

-- 5. Le parcours normal : les conditions sont remplies, on publie.
select pg_temp.transition_attendue('approved + draft (avec photo) → active accepté',
  '88882222-0000-0000-0000-000000000003', 'active');

-- 6. draft → sold direct. L'application ne propose pas ce chemin
-- (« Marquer vendu » ne s'affiche que sur un produit publié), mais la
-- base n'a aucune raison de le refuser QUAND les conditions sont
-- remplies : le produit arrive au catalogue avec sa photo et sa boutique
-- validée, exactement comme par 'active'. C'est le test suivant qui
-- porte la garantie de sécurité.
select pg_temp.transition_attendue('approved + draft (avec photo) → sold accepté',
  '88882222-0000-0000-0000-000000000004', 'sold');

-- Le cœur de 0018 : une boutique validée ne dispense PAS de la photo.
-- Sans ce test, la correction pourrait se contenter de vérifier la
-- boutique et laisser passer les vignettes vides.
select pg_temp.refus_attendu('approved + draft SANS photo → sold refusé',
  '88882222-0000-0000-0000-000000000005', 'sold');

-- 7. Le geste quotidien du commerçant, inchangé.
select pg_temp.transition_attendue('approved + active → sold accepté (comportement conservé)',
  '88882222-0000-0000-0000-000000000003', 'sold');
select pg_temp.transition_attendue('sold → active accepté (on reste dans l''ensemble visible)',
  '88882222-0000-0000-0000-000000000003', 'active');

-- Une création directe dans un statut public reste impossible : c'est
-- par là qu'on referait le trou en une ligne.
do $$
begin
  insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
    values ('88882222-0000-0000-0000-000000000006', '88881111-0000-0000-0000-000000000003',
            1, 'Insert direct vendu', 50000, 'sold');
  raise exception 'ECHEC un produit peut être CRÉÉ directement en sold';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    insert direct en sold refusé (%)', sqlerrm;
end $$;

-- Sortir du catalogue n'a jamais rien à prouver : masquer et remettre en
-- brouillon restent libres, y compris sans photo.
select pg_temp.transition_attendue('active → hidden accepté (sortie du catalogue)',
  '88882222-0000-0000-0000-000000000003', 'hidden');
select pg_temp.refus_attendu('hidden + boutique validée → sold repasse par le contrôle',
  '88882222-0000-0000-0000-000000000005', 'sold');
reset role;

-- --- 8 : un produit vendu légitime reste au catalogue ----------------
-- La décision de 0008 ne bouge pas. Si ce test tombait, 0018 aurait
-- « sécurisé » le catalogue en faisant disparaître les produits vendus.
select pg_temp.login('33333333-3333-3333-3333-333333333333');   -- Client C
set role authenticated;
select pg_temp.check('un produit vendu légitime reste visible du public',
  exists (select 1 from public.products
           where id = '88882222-0000-0000-0000-000000000004' and status = 'sold'));
select pg_temp.check('sa photo reste visible elle aussi',
  exists (select 1 from public.product_images
           where product_id = '88882222-0000-0000-0000-000000000004'));
select pg_temp.check('le brouillon sans photo reste invisible du public',
  not exists (select 1 from public.products
               where id = '88882222-0000-0000-0000-000000000005'));
reset role;


-- =====================================================================
-- 30. Une décision-- =====================================================================
-- 30. Une décision d'administration entre dans la file (0021)
-- =====================================================================
-- La suspension doit laisser une trace à envoyer par email, et la file
-- qui la porte ne doit être visible de personne. Les deux moitiés
-- comptent : une file muette ne prévient personne, une file lisible est
-- la liste de ce que l'administration a décidé sur chaque compte.

-- Deux boutiques neuves, pour partir d'une file propre et ne rien
-- déduire de ce que les 29 sections précédentes ont pu déclencher.
insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbb0000-0000-0000-0000-000000000001', 'notif1@test.gn', '{"role":"merchant","full_name":"Notif 1","phone":"620000031"}'),
  ('bbbb0000-0000-0000-0000-000000000002', 'notif2@test.gn', '{"role":"merchant","full_name":"Notif 2","phone":"620000032"}');

update public.profiles set id = auth_user_id
 where auth_user_id in ('bbbb0000-0000-0000-0000-000000000001',
                        'bbbb0000-0000-0000-0000-000000000002');

insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('bbbb1111-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 'Boutique Notif 1', 1),
  ('bbbb1111-0000-0000-0000-000000000002', 'bbbb0000-0000-0000-0000-000000000002', 'Boutique Notif 2', 1);

delete from public.notifications
 where profile_id in ('bbbb0000-0000-0000-0000-000000000001',
                      'bbbb0000-0000-0000-0000-000000000002');

-- --- 1 : ouvrir une boutique ne remplit pas la file (0033) ----------
select pg_temp.check('ouvrir une boutique ne remplit pas la file',
  (select count(*) from public.notifications
    where profile_id in ('bbbb0000-0000-0000-0000-000000000001',
                         'bbbb0000-0000-0000-0000-000000000002')) = 0);

-- --- 5 : une suspension entre dans la file ---------------------------
update public.profiles set is_suspended = true, suspended_at = now()
 where id = 'bbbb0000-0000-0000-0000-000000000002';

select pg_temp.check('une suspension remplit la file de notifications',
  (select count(*) from public.notifications
    where profile_id = 'bbbb0000-0000-0000-0000-000000000002'
      and kind = 'profile_suspended') = 1);

-- --- 6 : un rétablissement ne notifie rien ---------------------------
update public.profiles set is_suspended = false, suspended_at = null
 where id = 'bbbb0000-0000-0000-0000-000000000002';

select pg_temp.check('lever une suspension ne remplit pas la file',
  (select count(*) from public.notifications
    where profile_id = 'bbbb0000-0000-0000-0000-000000000002'
      and kind = 'profile_suspended') = 1);

-- --- 7 : LE TEST QUI COMPTE — la file n'est lisible par personne -----
-- Elle dit, ligne par ligne, quel compte a été suspendu et quelle
-- boutique a été refusée. C'est exactement ce qu'un concurrent ou un
-- curieux aimerait lire. RLS activée sans aucune policy suffit déjà à
-- tout refuser ; le `revoke` de 0021 est redondant EXPRÈS, et ce test
-- est ce qui prouve que la protection tient sans dépendre d'un effet de
-- bord — la leçon de 0002 partie 4.
select pg_temp.login('bbbb0000-0000-0000-0000-000000000001');
set role authenticated;

do $$
begin
  perform count(*) from public.notifications;
  raise exception 'ECHEC un commerçant a lu la file de notifications';
exception when insufficient_privilege then
  raise notice 'OK    un commercant ne peut pas lire la file de notifications';
end $$;

-- --- 8 : et il ne peut rien y écrire non plus ------------------------
-- Une file inscriptible, c'est un envoi d'email offert à qui veut : il
-- suffirait d'y déposer une ligne visant le profil de son choix.
do $$
begin
  insert into public.notifications (kind, profile_id)
  values ('merchant_approved', 'bbbb0000-0000-0000-0000-000000000001');
  raise exception 'ECHEC un commerçant a inséré dans la file de notifications';
exception when insufficient_privilege then
  raise notice 'OK    un commercant ne peut pas ecrire dans la file de notifications';
end $$;

reset role;

-- --- 9 : un visiteur non connecté non plus ---------------------------
set role anon;

do $$
begin
  perform count(*) from public.notifications;
  raise exception 'ECHEC un anonyme a lu la file de notifications';
exception when insufficient_privilege then
  raise notice 'OK    un anonyme ne peut pas lire la file de notifications';
end $$;

reset role;



-- =====================================================================
-- 31. Un CLIENT suspendu gèle aussi son fil (0022)
-- =====================================================================
-- Décision du porteur du projet, 2026-09-17 : on ne communique pas avec
-- un compte suspendu, quel que soit le côté du fil où il se trouve.
-- La section 26 a prouvé le cas de la BOUTIQUE suspendue ; celle-ci
-- prouve le cas miroir, qui est resté ouvert de 0017 au 2026-09-17 — un
-- client suspendu ne pouvait plus écrire, mais le commerçant, lui,
-- continuait de lui répondre dans le vide.

reset role;
-- On repart d'un fil parfaitement ouvert : ni boutique suspendue (26),
-- ni client suspendu, ni blocage (27). Sans cette remise à plat, un
-- « fermé » ci-dessous ne prouverait rien — il pourrait venir de
-- n'importe laquelle des sections précédentes.
update public.profiles set is_suspended = false where full_name = 'Boutique G';
update public.profiles set is_suspended = false where id = '44444444-4444-4444-4444-444444444444';
update public.conversations c set blocked_by = null
  from public.merchants m
 where m.id = c.merchant_id
   and m.shop_name = 'Boutique G'
   and c.client_id = '44444444-4444-4444-4444-444444444444';

-- (a) LE CAS NORMAL D'ABORD — sans lui, un gel généralisé passerait
--     pour un succès, et c'est la leçon de la section 26.
select pg_temp.login('77777777-7777-7777-7777-777777777777');
set role authenticated;

select pg_temp.check('client actif : le commercant peut ecrire',
  public.conversation_is_open(
    (select c.id from public.conversations c
       join public.merchants m on m.id = c.merchant_id
      where c.client_id = '44444444-4444-4444-4444-444444444444'
        and m.shop_name = 'Boutique G')));

insert into public.messages (conversation_id, sender_id, body)
  select c.id, m.profile_id, 'Oui, c''est disponible.'
    from public.conversations c
    join public.merchants m on m.id = c.merchant_id
   where c.client_id = '44444444-4444-4444-4444-444444444444'
     and m.shop_name = 'Boutique G';

select pg_temp.check('client actif : la reponse du commercant est passee',
  (select count(*) from public.messages msg
     join public.conversations c on c.id = msg.conversation_id
     join public.merchants m on m.id = c.merchant_id
    where m.shop_name = 'Boutique G'
      and msg.body = 'Oui, c''est disponible.') = 1);

reset role;

-- On suspend le CLIENT, et rien d'autre : la boutique reste approuvée et
-- active, l'historique reste entier.
update public.profiles set is_suspended = true, suspended_at = now()
 where id = '44444444-4444-4444-4444-444444444444';

-- (b) LE TEST QUI COMPTE — le commerçant ne peut plus répondre.
select pg_temp.login('77777777-7777-7777-7777-777777777777');
set role authenticated;

select pg_temp.check('client suspendu : le fil est ferme a l''ecriture',
  not public.conversation_is_open(
    (select c.id from public.conversations c
       join public.merchants m on m.id = c.merchant_id
      where c.client_id = '44444444-4444-4444-4444-444444444444'
        and m.shop_name = 'Boutique G')));

do $$
declare v_conv uuid; v_sender uuid;
begin
  select c.id, m.profile_id into v_conv, v_sender
    from public.conversations c
    join public.merchants m on m.id = c.merchant_id
   where c.client_id = '44444444-4444-4444-4444-444444444444'
     and m.shop_name = 'Boutique G';
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, v_sender, 'Vous etes toujours interesse ?');
  raise exception 'ECHEC un commerçant a ecrit a un client suspendu';
exception when insufficient_privilege then
  raise notice 'OK    un commercant ne peut pas ecrire a un client suspendu';
end $$;

-- (c) Et le fil reste LISIBLE : lecture seule, jamais suppression —
--     c'est la moitié de la décision qu'on oublie toujours de tester.
select pg_temp.check('client suspendu : le fil reste lisible par le commercant',
  (select count(*) from public.messages msg
     join public.conversations c on c.id = msg.conversation_id
     join public.merchants m on m.id = c.merchant_id
    where m.shop_name = 'Boutique G') >= 2);

reset role;

-- (d) Rétablir le client rouvre le fil. Une sanction qui ne se lève pas
--     est une suppression déguisée.
update public.profiles set is_suspended = false, suspended_at = null
 where id = '44444444-4444-4444-4444-444444444444';

select pg_temp.login('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pg_temp.check('client retabli : le fil se rouvre a l''ecriture',
  public.conversation_is_open(
    (select c.id from public.conversations c
       join public.merchants m on m.id = c.merchant_id
      where c.client_id = '44444444-4444-4444-4444-444444444444'
        and m.shop_name = 'Boutique G')));
reset role;


-- =====================================================================
-- Abonnements push : un appareil n'appartient qu'à une connexion (0023)
-- =====================================================================
-- Ces trois valeurs — endpoint, p256dh, auth_secret — forment ensemble le
-- droit d'écrire sur l'écran verrouillé de quelqu'un. Les voir, c'est
-- pouvoir lui envoyer une notification au nom de Filloo ; les écrire au
-- nom d'un autre, c'est détourner les siennes.

set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth_secret)
values ('11111111-1111-1111-1111-111111111111',
        'https://push.example/abonne-1', 'cle-p256dh-1', 'cle-auth-1');

select pg_temp.check('j''abonne mon propre appareil',
  (select count(*) = 1 from public.push_subscriptions
    where endpoint = 'https://push.example/abonne-1'));

-- (a) S'abonner au nom de quelqu'un d'autre : refusé par `with check`.
do $$
begin
  insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth_secret)
  values ('44444444-4444-4444-4444-444444444444',
          'https://push.example/vole', 'x', 'y');
  raise exception 'ECHEC un abonnement a pu etre cree au nom d''un autre';
exception when insufficient_privilege then
  raise notice 'OK    abonnement au nom d''un autre refuse (RLS)';
end $$;

reset role;

-- (b) L'appareil d'un autre reste invisible. On l'insère hors RLS, puis
--     on regarde ce que la personne voit : rien.
insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth_secret)
values ('44444444-4444-4444-4444-444444444444',
        'https://push.example/appareil-du-voisin', 'p', 'a');

set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select pg_temp.check('l''appareil d''un autre est invisible',
  (select count(*) = 0 from public.push_subscriptions
    where endpoint = 'https://push.example/appareil-du-voisin'));

-- (c) Et il ne se supprime pas non plus : une ligne qu'on ne voit pas
--     n'est pas une ligne qu'on peut effacer.
delete from public.push_subscriptions
 where endpoint = 'https://push.example/appareil-du-voisin';
reset role;
select pg_temp.check('l''appareil d''un autre survit a une tentative de suppression',
  (select count(*) = 1 from public.push_subscriptions
    where endpoint = 'https://push.example/appareil-du-voisin'));

-- (d) Le même appareil qui se réabonne REMPLACE sa ligne. Sans cette
--     contrainte, une personne recevrait deux fois chaque notification.
do $$
begin
  insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth_secret)
  values ('11111111-1111-1111-1111-111111111111',
          'https://push.example/abonne-1', 'autre', 'autre');
  raise exception 'ECHEC un endpoint a pu etre enregistre deux fois';
exception when unique_violation then
  raise notice 'OK    un endpoint ne s''enregistre qu''une fois';
end $$;



-- =====================================================================
-- Signalements : un seul EN ATTENTE par personne et par cible (0027)
-- =====================================================================
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
insert into public.reports (reporter_id, target_type, target_id, reason)
values ((select id from public.profiles where auth_user_id = '11111111-1111-1111-1111-111111111111' limit 1),
        'product', 'cccccccc-0000-0000-0000-000000000001', 'Prix suspect');

do $$
begin
  insert into public.reports (reporter_id, target_type, target_id, reason)
  values ((select id from public.profiles where auth_user_id = '11111111-1111-1111-1111-111111111111' limit 1),
          'product', 'cccccccc-0000-0000-0000-000000000001', 'Prix suspect');
  raise exception 'ECHEC un meme produit a ete signale deux fois par la meme personne';
exception when unique_violation then
  raise notice 'OK    un second signalement en attente est refuse';
end $$;
reset role;

-- Traité, le signalement libère la place : la cible peut revenir.
update public.reports set handled_at = now()
 where target_id = 'cccccccc-0000-0000-0000-000000000001';

set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
insert into public.reports (reporter_id, target_type, target_id, reason)
values ((select id from public.profiles where auth_user_id = '11111111-1111-1111-1111-111111111111' limit 1),
        'product', 'cccccccc-0000-0000-0000-000000000001', 'Toujours suspect');
reset role;
select pg_temp.check('apres traitement, la meme cible peut etre signalee de nouveau',
  (select count(*) = 2 from public.reports
    where target_id = 'cccccccc-0000-0000-0000-000000000001'));


-- =====================================================================
-- Le ménage (0028) : photos orphelines et mesures anciennes
-- =====================================================================
-- Une photo d'hier que rien ne référence est orpheline ; une photo
-- d'il y a une heure non, son formulaire est peut-être encore ouvert ;
-- une photo référencée jamais.
insert into storage.objects (bucket_id, name, created_at) values
  ('product-images', 'test-menage/abandonnee.webp', now() - interval '2 days'),
  ('product-images', 'test-menage/en-cours.webp',   now() - interval '1 hour'),
  ('product-images', 'x/1.webp',                    now() - interval '2 days');

select pg_temp.check('une photo abandonnee depuis plus de 24 h est orpheline',
  'test-menage/abandonnee.webp' in (select public.photos_orphelines()));
select pg_temp.check('une photo envoyee il y a une heure n''est pas touchee',
  'test-menage/en-cours.webp' not in (select public.photos_orphelines()));
select pg_temp.check('une photo referencee par un produit n''est jamais orpheline',
  'x/1.webp' not in (select public.photos_orphelines()));

set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
do $$
begin
  perform public.photos_orphelines();
  raise exception 'ECHEC un utilisateur peut lister les photos orphelines';
exception when insufficient_privilege then
  raise notice 'OK    la liste des orphelines est reservee au serveur';
end $$;
do $$
begin
  perform public.purger_mesures();
  raise exception 'ECHEC un utilisateur peut purger les mesures';
exception when insufficient_privilege then
  raise notice 'OK    la purge des mesures est reservee au serveur';
end $$;
reset role;

insert into public.analytics_events (name, occurred_at) values
  ('visite', now() - interval '14 months'),
  ('visite', now() - interval '12 months');
-- Deux instructions : dans une seule, la lecture verrait les lignes
-- d'avant la purge (même instantané).
select pg_temp.check('la purge retire une mesure, une seule', public.purger_mesures() = 1);
select pg_temp.check('la mesure de 12 mois reste, celle de 14 mois est partie',
  (select count(*) = 1 from public.analytics_events where occurred_at < now() - interval '11 months'));


-- =====================================================================
-- La photo de boutique (0029)
-- =====================================================================
-- Depuis 0037, la photo s'écrit avec le reste de la boutique, par
-- `modifier_ma_boutique` (serveur, après le mot de passe) : les autres
-- champs sont repassés tels quels.
select shop_name as a_nom, city_id as a_ville from public.merchants
 where id = 'aaaaaaaa-0000-0000-0000-000000000001' \gset
set role service_role;
select public.modifier_ma_boutique('11111111-1111-1111-1111-111111111111',
  :'a_nom', :a_ville, null, null, null, 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp');
reset role;
select pg_temp.check('un commercant pose la photo de sa boutique',
  (select photo_path = 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp'
     from public.merchants where id = 'aaaaaaaa-0000-0000-0000-000000000001'));

-- La faille que la contrainte ferme : afficher la photo d'un concurrent.
-- Le serveur aussi y est soumis : la fonction ne contourne pas la table.
set role service_role;
do $$
begin
  perform public.modifier_ma_boutique('11111111-1111-1111-1111-111111111111',
    'Chez A', 1, null, null, null, 'bbbbbbbb-0000-0000-0000-000000000002/sa-photo.webp');
  raise exception 'ECHEC une boutique affiche la photo d''une autre';
exception when check_violation then
  raise notice 'OK    la photo d''une autre boutique est refusee';
end $$;
do $$
begin
  perform public.modifier_ma_boutique('11111111-1111-1111-1111-111111111111',
    'Chez A', 1, null, null, null, 'aaaaaaaa-0000-0000-0000-000000000001/../bbbbbbbb-0000-0000-0000-000000000002/x.webp');
  raise exception 'ECHEC un chemin en .. passe la contrainte';
exception when check_violation then
  raise notice 'OK    un chemin en .. est refuse';
end $$;
reset role;

set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

-- Le stockage : écrire chez soi, jamais chez l'autre.
insert into storage.objects (bucket_id, name)
values ('shop-photos', 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp');
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('shop-photos', 'bbbbbbbb-0000-0000-0000-000000000002/pirate.webp');
  raise exception 'ECHEC un commercant envoie une photo dans le dossier d''une autre boutique';
exception when insufficient_privilege then
  raise notice 'OK    envoi refuse dans le dossier d''une autre boutique';
end $$;
reset role;
select pg_temp.check('un commercant envoie la photo dans son dossier',
  exists (select 1 from storage.objects
           where bucket_id = 'shop-photos' and name = 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp'));

-- Un client n'est pas une boutique : `my_merchant_id()` est nul pour lui.
set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');
do $$
begin
  insert into storage.objects (bucket_id, name) values ('shop-photos', 'x/client.webp');
  raise exception 'ECHEC un client envoie une photo de boutique';
exception when insufficient_privilege then
  raise notice 'OK    un client ne peut pas envoyer de photo de boutique';
end $$;
reset role;

set role anon;
select pg_temp.check('un visiteur voit la photo d''une boutique',
  exists (select 1 from storage.objects
           where bucket_id = 'shop-photos' and name = 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp'));
reset role;

-- La raison du bucket séparé : le ménage de 0028 ne doit JAMAIS la voir.
update storage.objects set created_at = now() - interval '2 days'
 where bucket_id = 'shop-photos';
select pg_temp.check('le menage des photos de produits ignore les photos de boutique',
  'aaaaaaaa-0000-0000-0000-000000000001/moi.webp' not in (select public.photos_orphelines()));

-- 0030 : la recherche remonte la photo, pour un visiteur non connecté.
set role anon;
select pg_temp.check('la recherche remonte la photo de la boutique',
  exists (select 1 from public.search_products()
           where merchant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
             and shop_photo_path = 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp'));
reset role;

-- =====================================================================
-- Le mot de passe redemandé est vérifié par le serveur (0036, 0037)
-- =====================================================================
-- La faille : le site et l'app vérifiaient le mot de passe, puis
-- écrivaient avec la session — qui suffisait seule à réécrire le WhatsApp
-- d'une boutique. Une session ne doit plus pouvoir écrire ces colonnes,
-- ni appeler les fonctions qui le font.
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
do $$
declare
  essai text;
begin
  foreach essai in array array[
    'update public.merchants set whatsapp_phone = ''+224 600 00 00 00'' where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
    'update public.merchants set address_hint = ''ailleurs'' where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
    'update public.merchants set shop_name = ''Imposteur'' where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
    'update public.merchants set city_id = 2 where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
    'update public.merchants set description = ''x'' where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
    'update public.merchants set photo_path = null where id = ''aaaaaaaa-0000-0000-0000-000000000001''',
    'update public.profiles set phone = ''620999999'' where auth_user_id = ''11111111-1111-1111-1111-111111111111''',
    'update public.profiles set full_name = ''Imposteur'' where auth_user_id = ''11111111-1111-1111-1111-111111111111''',
    'select public.modifier_ma_boutique(''11111111-1111-1111-1111-111111111111'', ''Imposteur'', 1, null, null, null, null)',
    'select public.modifier_mes_informations(''11111111-1111-1111-1111-111111111111'', ''Imposteur'', ''620999999'')'
  ] loop
    begin
      execute essai;
      raise exception 'ECHEC une session ecrit sans mot de passe : %', essai;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  raise notice 'OK    une session seule n''ecrit ni boutique, ni nom, ni telephone';
end $$;
reset role;

set role anon;
do $$
begin
  perform public.modifier_mes_informations('11111111-1111-1111-1111-111111111111', 'Imposteur', '620999999');
  raise exception 'ECHEC un visiteur appelle modifier_mes_informations';
exception when insufficient_privilege then
  raise notice 'OK    un visiteur n''appelle pas les fonctions du serveur';
end $$;
reset role;

-- Ce qui reste permis sans mot de passe : la ville du client (0010).
set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');
update public.profiles set city_id = 1 where auth_user_id = '33333333-3333-3333-3333-333333333333';
reset role;
select pg_temp.check('un client change sa ville sans mot de passe',
  (select city_id = 1 from public.profiles where id = '33333333-3333-3333-3333-333333333333'));

-- Le serveur, lui, écrit — et seulement chez la bonne personne.
set role service_role;
select pg_temp.check('le serveur modifie la boutique de la connexion',
  public.modifier_ma_boutique('11111111-1111-1111-1111-111111111111',
    'Chez A', 1, 'Marché Madina', '620000001', null, null)
  = 'aaaaaaaa-0000-0000-0000-000000000001');
select public.modifier_ma_boutique('11111111-1111-1111-1111-111111111111', 'Chez A', 1, '', '', '', '');
reset role;
select pg_temp.check('un champ facultatif vide s''enregistre null',
  (select address_hint is null and whatsapp_phone is null and description is null and photo_path is null
     from public.merchants where id = 'aaaaaaaa-0000-0000-0000-000000000001'));
set role service_role;
select pg_temp.check('un client sans boutique : rien n''est ecrit',
  public.modifier_ma_boutique('33333333-3333-3333-3333-333333333333',
    'Imposteur', 1, null, null, null, null) is null);
-- C a deux profils liés (client et commerçant) : les deux suivent.
select pg_temp.check('le serveur modifie nom et telephone de la connexion',
  public.modifier_mes_informations('33333333-3333-3333-3333-333333333333', 'Client C', '620000033') = 2);
reset role;
select pg_temp.check('nom et telephone suivent sur tous les profils de la connexion',
  (select bool_and(phone = '620000033' and full_name = 'Client C') from public.profiles
    where auth_user_id = '33333333-3333-3333-3333-333333333333'));
select pg_temp.check('la boutique B n''a pas bouge',
  (select shop_name = 'Chez B' from public.merchants where id = 'bbbbbbbb-0000-0000-0000-000000000002'));
select pg_temp.check('le telephone de D n''a pas bouge',
  (select phone <> '620000033' from public.profiles where id = '44444444-4444-4444-4444-444444444444'));

-- Un commerçant suspendu ne modifie plus sa boutique, comme avec la policy.
update public.profiles set is_suspended = true where id = '11111111-1111-1111-1111-111111111111';
set role service_role;
select pg_temp.check('commercant suspendu : la boutique ne bouge pas',
  public.modifier_ma_boutique('11111111-1111-1111-1111-111111111111',
    'Imposteur', 1, null, null, null, null) is null);
reset role;
update public.profiles set is_suspended = false where id = '11111111-1111-1111-1111-111111111111';

-- Un profil supprimé reste anonymisé.
update public.profiles set is_deleted = true where id = '44444444-4444-4444-4444-444444444444';
set role service_role;
select pg_temp.check('un profil supprime n''est pas reecrit',
  public.modifier_mes_informations('44444444-4444-4444-4444-444444444444', 'Revenant', '620999999') = 0);
reset role;
update public.profiles set is_deleted = false where id = '44444444-4444-4444-4444-444444444444';

-- =====================================================================
-- Chacun n'entend que ses propres messages (0038)
-- =====================================================================
-- Fil Client D <-> Boutique A (dddd…0002), débloqué section 17. Les
-- messages des sections précédentes ont déjà diffusé : on repart d'une
-- file vide pour compter juste.
truncate realtime.messages;

set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');   -- Client D
insert into public.messages (conversation_id, sender_id, body)
values ('dddddddd-0000-0000-0000-000000000002',
        '44444444-4444-4444-4444-444444444444', 'Diffusion 0038 (1)');
reset role;

select pg_temp.check('un message envoye diffuse vers les DEUX participants, et eux seuls',
  (select array_agg(topic order by topic) from realtime.messages
    where payload ->> 'body' = 'Diffusion 0038 (1)')
  = array['user:11111111-1111-1111-1111-111111111111',
          'user:44444444-4444-4444-4444-444444444444']);
select pg_temp.check('la diffusion est privee, en broadcast, evenement message',
  (select bool_and(private and extension = 'broadcast' and event = 'message')
     from realtime.messages));
select pg_temp.check('la diffusion porte exactement le contrat attendu par les clients',
  (select bool_and(
            payload ->> 'op' = 'INSERT'
        and payload ->> 'conversation_id' = 'dddddddd-0000-0000-0000-000000000002'
        and payload ->> 'sender_id' = '44444444-4444-4444-4444-444444444444'
        and payload ->> 'id' = (select id::text from public.messages where body = 'Diffusion 0038 (1)')
        and (select array_agg(k order by k) from jsonb_object_keys(payload) k)
            = array['body','conversation_id','created_at','id','op','product_id','read_at','sender_id'])
     from realtime.messages));

-- Deux messages de plus, puis la boutique marque le fil lu d'un coup.
set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');
insert into public.messages (conversation_id, sender_id, body) values
  ('dddddddd-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Diffusion 0038 (2)'),
  ('dddddddd-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Diffusion 0038 (3)');
reset role;
select pg_temp.check('un envoi de deux messages diffuse deux fois par participant',
  (select count(*) from realtime.messages where payload ->> 'body' like 'Diffusion 0038 (_)') = 6);

truncate realtime.messages;
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');   -- Boutique A
with lus as (
  update public.messages set read_at = now()
   where conversation_id = 'dddddddd-0000-0000-0000-000000000002' and read_at is null
     and sender_id = '44444444-4444-4444-4444-444444444444'
  returning 1
)
select pg_temp.check('le marquage lu touche plusieurs messages', (select count(*) from lus) >= 3);
reset role;
select pg_temp.check('un fil marque lu diffuse UN evenement par participant, pas un par message',
  (select array_agg(topic order by topic) from realtime.messages)
  = array['user:11111111-1111-1111-1111-111111111111',
          'user:44444444-4444-4444-4444-444444444444']);
select pg_temp.check('l''evenement de lecture dit quel fil, et rien du contenu',
  (select bool_and(payload ->> 'op' = 'UPDATE'
               and payload ->> 'conversation_id' = 'dddddddd-0000-0000-0000-000000000002'
               and payload ->> 'read_at' is not null
               and payload -> 'body' = 'null'::jsonb)
     from realtime.messages));

-- Un marquage qui ne change rien ne diffuse rien.
truncate realtime.messages;
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
update public.messages set read_at = now()
 where conversation_id = 'dddddddd-0000-0000-0000-000000000002' and read_at is null;
reset role;
select pg_temp.check('un marquage sans effet ne diffuse rien',
  (select count(*) from realtime.messages) = 0);

-- Lire : chacun son canal. Quand un client ouvre un canal privé,
-- Realtime pose `realtime.topic` (le canal demandé) et l'identité, puis
-- lit `realtime.messages` : pas de ligne visible, pas de canal. La
-- politique juge donc le canal DEMANDÉ, pas la colonne `topic`.
set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');
insert into public.messages (conversation_id, sender_id, body)
values ('dddddddd-0000-0000-0000-000000000002',
        '44444444-4444-4444-4444-444444444444', 'Diffusion 0038 (4)');

select pg_temp.login('11111111-1111-1111-1111-111111111111');   -- destinataire
select set_config('realtime.topic', 'user:11111111-1111-1111-1111-111111111111', false);
select pg_temp.check('le destinataire ouvre son canal et y lit la diffusion',
  (select count(*) from realtime.messages
    where topic = realtime.topic() and payload ->> 'body' = 'Diffusion 0038 (4)') = 1);
select set_config('realtime.topic', 'user:44444444-4444-4444-4444-444444444444', false);
select pg_temp.check('le destinataire n''ouvre pas le canal de son interlocuteur',
  (select count(*) from realtime.messages) = 0);

select pg_temp.login('22222222-2222-2222-2222-222222222222');   -- tiers
select set_config('realtime.topic', 'user:11111111-1111-1111-1111-111111111111', false);
select pg_temp.check('un tiers connecte ne lit pas le canal d''un autre',
  (select count(*) from realtime.messages) = 0);
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('realtime.topic', 'user:11111111-1111-1111-1111-111111111111', false);
select pg_temp.check('un visiteur ne lit aucune diffusion',
  (select count(*) from realtime.messages) = 0);
reset role;

-- Émettre : personne, ni en direct ni par la fonction.
set role authenticated;
select pg_temp.login('22222222-2222-2222-2222-222222222222');
do $$
begin
  insert into realtime.messages (topic, extension, payload, event, private)
  values ('user:11111111-1111-1111-1111-111111111111', 'broadcast',
          '{"op":"INSERT","body":"faux"}', 'message', true);
  raise exception 'ECHEC un client ecrit sur le canal d''un autre';
exception when insufficient_privilege then
  raise notice 'OK    un client n''ecrit pas dans realtime.messages';
end $$;
-- `realtime.send` reste exécutable par tous chez Supabase, mais elle
-- s'exécute avec les droits de l'appelant : le RLS la refuse, et elle
-- avale l'erreur.
select realtime.send('{"body":"faux"}', 'message', 'user:11111111-1111-1111-1111-111111111111', true);
reset role;
select pg_temp.check('un client n''emet rien, meme par realtime.send',
  not exists (select 1 from realtime.messages where payload ->> 'body' = 'faux'));

select pg_temp.check('personne n''execute la fonction de diffusion',
  not has_function_privilege('anon', 'public.diffuser_message_aux_participants()', 'execute')
  and not has_function_privilege('authenticated', 'public.diffuser_message_aux_participants()', 'execute'));

-- Une diffusion en panne n'empêche pas d'écrire. On remplace
-- `realtime.send` par une version qui lève, le temps d'une transaction
-- annulée ensuite.
begin;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
  returns void language plpgsql as $$ begin raise exception 'Realtime en panne'; end $$;
set local role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');
insert into public.messages (conversation_id, sender_id, body)
values ('dddddddd-0000-0000-0000-000000000002',
        '44444444-4444-4444-4444-444444444444', 'Diffusion 0038 en panne');
reset role;
select pg_temp.check('une diffusion qui echoue n''empeche pas l''envoi du message',
  exists (select 1 from public.messages where body = 'Diffusion 0038 en panne'));
rollback;
select pg_temp.check('realtime.send est bien restauree',
  pg_get_functiondef('realtime.send(jsonb,text,text,boolean)'::regprocedure) like '%WarnSendingBroadcastMessage%');
select set_config('realtime.topic', '', false);

-- =====================================================================
-- Les règles d'accès demandent « qui es-tu ? » une fois par requête (0039)
-- =====================================================================
-- 0039 réécrit les policies sans en changer le sens : toute la suite
-- ci-dessus, qui tourne APRÈS elle, est la preuve principale. Ce bloc
-- ajoute la forme (plus aucun appel par ligne) et les refus que la
-- suite ne couvrait pas encore sur les policies découpées.

-- La forme : `my_profile_id` / `my_merchant_id` n'apparaissent plus que
-- dans un `( SELECT … AS …)`, c'est-à-dire un InitPlan.
select pg_temp.check('aucune policy n''appelle my_merchant_id a chaque ligne',
  not exists (select 1 from pg_policies
               where coalesce(qual, '') || ' ' || coalesce(with_check, '')
                     ~ 'my_merchant_id\(\)(?! AS my_merchant_id)'));
select pg_temp.check('aucune policy n''appelle my_profile_id a chaque ligne',
  not exists (select 1 from pg_policies
               where coalesce(qual, '') || ' ' || coalesce(with_check, '')
                     ~ 'my_profile_id\(''[a-z]+''::user_role\)(?! AS my_profile_id|\) AS is_active_profile)'));

-- Plus de doublon de lecture : une seule policy sert le SELECT.
select pg_temp.check('products : une seule policy de lecture',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'products' and cmd in ('SELECT', 'ALL')) = 1);
select pg_temp.check('product_images : une seule policy de lecture',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'product_images' and cmd in ('SELECT', 'ALL')) = 1);

-- Le gain lui-même : le plan évalue « ma boutique » une fois (InitPlan).
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
do $$
declare plan text := '';
        ligne text;
begin
  for ligne in execute 'explain (costs off) select * from public.products' loop
    plan := plan || ligne || E'\n';
  end loop;
  perform pg_temp.check('le catalogue evalue ma boutique une fois par requete',
    plan like '%InitPlan%');
end $$;

-- Ce que « je gere » laissait lire passe toujours par « catalogue public » :
-- A voit son brouillon, B et un visiteur non.
insert into public.products (id, merchant_id, category_id, title, price_gnf)
values ('cccccccc-0000-0000-0000-000000000039', 'aaaaaaaa-0000-0000-0000-000000000001',
        1, 'Brouillon 0039', 1000);
insert into public.product_images (product_id, storage_path, position)
values ('cccccccc-0000-0000-0000-000000000039',
        'aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000039/0.webp', 0);
select pg_temp.check('le commercant voit son brouillon et sa photo',
  exists (select 1 from public.products where id = 'cccccccc-0000-0000-0000-000000000039')
  and exists (select 1 from public.product_images where product_id = 'cccccccc-0000-0000-0000-000000000039'));
reset role;

set role authenticated;
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.check('un autre commercant ne voit ni le brouillon ni sa photo',
  not exists (select 1 from public.products where id = 'cccccccc-0000-0000-0000-000000000039')
  and not exists (select 1 from public.product_images where product_id = 'cccccccc-0000-0000-0000-000000000039'));

-- B n'écrit rien chez A : ni produit, ni photo, ni suppression.
do $$
begin
  insert into public.products (merchant_id, category_id, title, price_gnf)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'Intrus', 1);
  raise exception 'ECHEC un commercant cree un produit dans la boutique d''un autre';
exception when insufficient_privilege then
  raise notice 'OK    produit refuse dans la boutique d''un autre';
end $$;
do $$
begin
  insert into public.product_images (product_id, storage_path, position)
  values ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002/x.webp', 3);
  raise exception 'ECHEC un commercant ajoute une photo au produit d''un autre';
exception when insufficient_privilege then
  raise notice 'OK    photo refusee sur le produit d''un autre';
end $$;
with suppr as (
  delete from public.products where id = 'cccccccc-0000-0000-0000-000000000002' returning 1
)
select pg_temp.check('suppression du produit d''autrui bloquee', (select count(*) from suppr) = 0);
with suppr as (
  delete from public.product_images where product_id = 'cccccccc-0000-0000-0000-000000000002' returning 1
)
select pg_temp.check('suppression des photos d''autrui bloquee', (select count(*) from suppr) = 0);
with modif as (
  update public.product_images set position = 4
   where product_id = 'cccccccc-0000-0000-0000-000000000002' returning 1
)
select pg_temp.check('modification des photos d''autrui bloquee', (select count(*) from modif) = 0);

-- Le stockage des photos produits : mon dossier, pas celui de A.
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('product-images', 'aaaaaaaa-0000-0000-0000-000000000001/pirate.webp');
  raise exception 'ECHEC un commercant envoie une photo produit dans le dossier d''un autre';
exception when insufficient_privilege then
  raise notice 'OK    photo produit refusee dans le dossier d''un autre';
end $$;
insert into storage.objects (bucket_id, name)
values ('product-images', 'bbbbbbbb-0000-0000-0000-000000000002/0039.webp');
reset role;
-- Les refus ci-dessus portent sur des lignes qui existent bien.
select pg_temp.check('le produit de A et ses photos ont survecu a B',
  exists (select 1 from public.products where id = 'cccccccc-0000-0000-0000-000000000002')
  and exists (select 1 from public.product_images
               where product_id = 'cccccccc-0000-0000-0000-000000000002' and position <> 4));
select pg_temp.check('B envoie une photo produit dans son propre dossier',
  exists (select 1 from storage.objects
           where bucket_id = 'product-images' and name = 'bbbbbbbb-0000-0000-0000-000000000002/0039.webp'));

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('un visiteur ne voit pas le brouillon',
  not exists (select 1 from public.products where id = 'cccccccc-0000-0000-0000-000000000039'));
reset role;

-- Un commerçant suspendu n'écrit plus dans ses propres produits : la
-- partie « compte actif » des policies découpées.
update public.profiles set is_suspended = true where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
do $$
begin
  insert into public.products (merchant_id, category_id, title, price_gnf)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'Pendant la suspension', 1);
  raise exception 'ECHEC un commercant suspendu cree un produit';
exception when insufficient_privilege then
  raise notice 'OK    un commercant suspendu ne cree pas de produit';
end $$;
with suppr as (
  delete from public.product_images where product_id = 'cccccccc-0000-0000-0000-000000000039' returning 1
)
select pg_temp.check('un commercant suspendu ne retire pas ses photos', (select count(*) from suppr) = 0);
with suppr as (
  delete from public.products where id = 'cccccccc-0000-0000-0000-000000000039' returning 1
)
select pg_temp.check('un commercant suspendu ne retire pas ses produits', (select count(*) from suppr) = 0);
reset role;
update public.profiles set is_suspended = false where id = '11111111-1111-1111-1111-111111111111';

-- Rétabli, il retire son brouillon : la policy de suppression laisse
-- passer le propriétaire.
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
with suppr as (
  delete from public.products where id = 'cccccccc-0000-0000-0000-000000000039' returning 1
)
select pg_temp.check('le commercant retire son propre brouillon', (select count(*) from suppr) = 1);
reset role;

-- Index des clés étrangères.
select pg_temp.check('notifications.profile_id et profiles.city_id sont indexes',
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'notifications_profile_idx')
  and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_city_idx'));


-- =====================================================================
-- Le dossier des photos produits n'accepte que des images raisonnables (0040)
-- =====================================================================
-- La taille et le type sont refusés par le service Storage, à l'envoi :
-- Postgres ne fait que porter le réglage, et le stub local n'a pas de
-- service Storage. On vérifie donc le réglage, pas le refus.
select pg_temp.check('product-images : 1 Mo au plus',
  (select file_size_limit from storage.buckets where id = 'product-images') = 1048576);
select pg_temp.check('product-images : WebP et JPEG seulement',
  (select allowed_mime_types from storage.buckets where id = 'product-images')
    = array['image/webp', 'image/jpeg']);
select pg_temp.check('shop-photos inchange',
  (select file_size_limit = 1048576 and allowed_mime_types = array['image/webp', 'image/jpeg']
     from storage.buckets where id = 'shop-photos'));

-- =====================================================================
-- Un compte supprimé peut être recréé sur la même connexion (0041)
-- =====================================================================
-- G : un compte client puis une boutique sur la même connexion. Il
-- supprime son compte client (le serveur l'anonymise, en service_role),
-- puis en recrée un. H : même chose, mais son compte client avait été
-- suspendu avant d'être supprimé.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0410000-0000-0000-0000-000000000001', 'g0041@test.gn', '{"role":"client","full_name":"Client G","phone":"620004101"}'),
  ('a0410000-0000-0000-0000-000000000002', 'h0041@test.gn', '{"role":"client","full_name":"Client H","phone":"620004102"}');
update public.profiles set id = 'a0410000-0000-0000-0000-0000000000c1'
 where auth_user_id = 'a0410000-0000-0000-0000-000000000001';
update public.profiles set id = 'a0410000-0000-0000-0000-0000000000c2'
 where auth_user_id = 'a0410000-0000-0000-0000-000000000002';

set role authenticated;
select pg_temp.login('a0410000-0000-0000-0000-000000000001');
insert into public.profiles (id, auth_user_id, role, full_name, phone)
values ('a0410000-0000-0000-0000-0000000000a1', 'a0410000-0000-0000-0000-000000000001',
        'merchant', 'Client G', '620004101');
reset role;

-- La suppression du seul compte client, comme `supprimerProfil`.
update public.profiles
   set full_name = 'Compte supprimé', phone = '000000000', is_deleted = true, deleted_at = now()
 where id = 'a0410000-0000-0000-0000-0000000000c1';

set role authenticated;
select pg_temp.login('a0410000-0000-0000-0000-000000000001');
select pg_temp.check('0041 : un compte supprime n''est plus « mon profil client »',
  public.my_profile_id('client') is null);

do $$
begin
  insert into public.profiles (id, auth_user_id, role, full_name, phone)
  values ('a0410000-0000-0000-0000-0000000000c3', 'a0410000-0000-0000-0000-000000000001',
          'client', 'Client G', '620004101');
  raise notice 'OK    0041 : un compte client supprime se recree sur la meme connexion';
exception when unique_violation then
  raise exception 'ECHEC 0041 : le compte client supprime bloque la recreation';
end $$;

select pg_temp.check('0041 : my_profile_id(''client'') renvoie le NOUVEAU profil',
  public.my_profile_id('client') = 'a0410000-0000-0000-0000-0000000000c3');

do $$
begin
  insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('a0410000-0000-0000-0000-000000000001', 'client', 'Client G bis', '620004101');
  raise exception 'ECHEC 0041 : deux profils client ACTIFS sur la meme connexion';
exception when unique_violation then
  raise notice 'OK    0041 : deux profils client actifs restent impossibles';
end $$;

-- Une ligne insérée déjà « supprimée » échapperait à l'index partiel :
-- sans ce refus, une session empilerait des profils sans limite.
do $$
begin
  insert into public.profiles (auth_user_id, role, full_name, phone, is_deleted)
  values ('a0410000-0000-0000-0000-000000000001', 'client', 'Fantome', '620004101', true);
  raise exception 'ECHEC 0041 : un profil insere deja supprime echappe a l''unicite';
exception when insufficient_privilege then
  raise notice 'OK    0041 : impossible d''inserer un profil deja supprime';
end $$;

select pg_temp.check('0041 : le profil commercant n''est pas touche',
  public.my_profile_id('merchant') = 'a0410000-0000-0000-0000-0000000000a1'
  and (select not is_deleted and full_name = 'Client G'
         from public.profiles where id = 'a0410000-0000-0000-0000-0000000000a1'));
reset role;

select pg_temp.check('0041 : l''ancien profil supprime reste, anonymise',
  (select count(*) from public.profiles
    where auth_user_id = 'a0410000-0000-0000-0000-000000000001'
      and role = 'client' and is_deleted and full_name = 'Compte supprimé') = 1);
select pg_temp.check('0041 : la contrainte (connexion, role) est un index partiel sur les profils actifs',
  not exists (select 1 from pg_constraint where conname = 'profiles_auth_user_id_role_key')
  and exists (select 1 from pg_indexes where schemaname = 'public'
                 and indexname = 'profiles_un_profil_actif_par_role'
                 and indexdef like '%UNIQUE%WHERE (is_deleted = false)%'));

-- H : suspendu, puis supprimé. La suppression n'efface pas la sanction.
update public.profiles set is_suspended = true, suspended_at = now()
 where id = 'a0410000-0000-0000-0000-0000000000c2';
set role authenticated;
select pg_temp.login('a0410000-0000-0000-0000-000000000002');
insert into public.profiles (auth_user_id, role, full_name, phone)
values ('a0410000-0000-0000-0000-000000000002', 'merchant', 'Client H', '620004102');
select pg_temp.check('0041 : un compte suspendu garde le droit de creer l''AUTRE role',
  public.my_profile_id('merchant') is not null);
reset role;
update public.profiles set is_deleted = true, deleted_at = now()
 where id = 'a0410000-0000-0000-0000-0000000000c2';
set role authenticated;
select pg_temp.login('a0410000-0000-0000-0000-000000000002');
do $$
begin
  insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('a0410000-0000-0000-0000-000000000002', 'client', 'Client H', '620004102');
  raise exception 'ECHEC 0041 : supprimer un compte suspendu puis le recreer leve la suspension';
exception when insufficient_privilege then
  raise notice 'OK    0041 : un compte suspendu puis supprime ne se recree pas';
end $$;
reset role;

select pg_temp.check('0041 : my_role_is_suspended fermee a anon, ouverte a authenticated',
  not has_function_privilege('anon', 'public.my_role_is_suspended(public.user_role)', 'execute')
  and has_function_privilege('authenticated', 'public.my_role_is_suspended(public.user_role)', 'execute'));


-- =====================================================================
-- L'équipe parle avec chaque personne inscrite (0042)
-- =====================================================================
-- S : membre de l'équipe (inscrit au tableau de bord). A : commerçant,
-- K et D : clients, déjà inscrits. L : client inscrit APRÈS l'annonce.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0420000-0000-0000-0000-000000000005', 's0042@test.gn', '{"role":"client","full_name":"Collegue S","phone":"620004201"}'),
  ('a0420000-0000-0000-0000-00000000000b', 'k0042@test.gn', '{"role":"client","full_name":"Client K","phone":"620004203"}');
insert into public.equipe (auth_user_id, nom) values ('a0420000-0000-0000-0000-000000000005', 'S');

set role authenticated;

-- Personne n'entre dans l'équipe depuis un écran.
select pg_temp.login('a0420000-0000-0000-0000-00000000000b');
do $$
begin
  insert into public.equipe (auth_user_id, nom) values ('a0420000-0000-0000-0000-00000000000b', 'Pirate');
  raise exception 'ECHEC 0042 : un client s''inscrit lui-meme dans l''equipe';
exception when insufficient_privilege then
  raise notice 'OK    0042 : on n''entre pas dans l''equipe depuis un ecran';
end $$;
select pg_temp.check('0042 : un client ne voit pas l''equipe', (select count(*) from public.equipe) = 0);
select pg_temp.check('0042 : un client n''est pas de l''equipe', not public.je_suis_de_l_equipe());

-- Un client ne publie pas d'annonce.
do $$
begin
  insert into public.annonces (auteur_id, titre, corps, public, etat)
  values ('a0420000-0000-0000-0000-00000000000b', 'Faux', 'Fausse annonce', 'tous', 'publiee');
  raise exception 'ECHEC 0042 : un client publie une annonce';
exception when insufficient_privilege then
  raise notice 'OK    0042 : un client ne publie pas d''annonce';
end $$;

-- S publie une annonce aux commerçants, puis une à tous.
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0042 : S est de l''equipe', public.je_suis_de_l_equipe());
do $$
begin
  insert into public.annonces (auteur_id, titre, corps, public, etat)
  values ('11111111-1111-1111-1111-111111111111', 'Usurpee', 'Au nom d''un autre', 'tous', 'publiee');
  raise exception 'ECHEC 0042 : l''equipe publie au nom d''un autre';
exception when insufficient_privilege then
  raise notice 'OK    0042 : une annonce porte le nom de qui la publie';
end $$;
insert into public.annonces (id, auteur_id, titre, corps, public, etat) values
  ('a0420000-0000-0000-0000-0000000000a1', 'a0420000-0000-0000-0000-000000000005', 'Aux commercants', 'Bonjour les commercants', 'commercants', 'publiee'),
  ('a0420000-0000-0000-0000-0000000000a2', 'a0420000-0000-0000-0000-000000000005', 'A tous', 'Bonjour a tous', 'tous', 'publiee');
reset role;

-- L s'inscrit APRÈS les deux annonces.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0420000-0000-0000-0000-00000000000c', 'l0042@test.gn', '{"role":"client","full_name":"Client L","phone":"620004202"}');

select pg_temp.check('0042 : l''annonce aux commercants atteint A, pas K',
  exists (select 1 from public.annonce_destinataires
           where annonce_id = 'a0420000-0000-0000-0000-0000000000a1' and auth_user_id = '11111111-1111-1111-1111-111111111111')
  and not exists (select 1 from public.annonce_destinataires
           where annonce_id = 'a0420000-0000-0000-0000-0000000000a1' and auth_user_id = 'a0420000-0000-0000-0000-00000000000b'));
select pg_temp.check('0042 : une connexion a deux comptes recoit l''annonce une seule fois',
  (select count(*) from public.annonce_destinataires
    where annonce_id = 'a0420000-0000-0000-0000-0000000000a2'
      and auth_user_id = '33333333-3333-3333-3333-333333333333') = 1);

set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-00000000000b');
select pg_temp.check('0042 : K voit l''annonce a tous, pas celle aux commercants',
  (select array_agg(id::text order by id) from public.annonces) = array['a0420000-0000-0000-0000-0000000000a2']);
select pg_temp.check('0042 : K ne voit que ses propres destinataires',
  (select bool_and(auth_user_id = 'a0420000-0000-0000-0000-00000000000b') from public.annonce_destinataires));

select pg_temp.login('a0420000-0000-0000-0000-00000000000c');
select pg_temp.check('0042 : inscrit apres, L ne voit aucune annonce', (select count(*) from public.annonces) = 0);

-- K répond à l'annonce : dans SON fil seulement, jamais au nom de l'équipe.
select pg_temp.login('a0420000-0000-0000-0000-00000000000b');
insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps, annonce_id, created_at, lu_at)
values ('a0420000-0000-0000-0000-00000000000b', 'client', 'a0420000-0000-0000-0000-00000000000b', false,
        'Merci !', 'a0420000-0000-0000-0000-0000000000a2', '2020-01-01', now());
select pg_temp.check('0042 : l''heure et l''etat lu viennent du serveur',
  (select created_at > now() - interval '1 minute' and lu_at is null from public.fil_equipe));
do $$
begin
  insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
  values ('a0420000-0000-0000-0000-00000000000b', 'client', 'a0420000-0000-0000-0000-00000000000b', true, 'Je suis l''equipe');
  raise exception 'ECHEC 0042 : un client ecrit au nom de l''equipe';
exception when insufficient_privilege then
  raise notice 'OK    0042 : un client n''ecrit pas au nom de l''equipe';
end $$;
do $$
begin
  insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
  values ('44444444-4444-4444-4444-444444444444', 'client', 'a0420000-0000-0000-0000-00000000000b', false, 'Chez D');
  raise exception 'ECHEC 0042 : un client ecrit dans le fil d''un autre';
exception when insufficient_privilege then
  raise notice 'OK    0042 : un client n''ecrit que dans son fil';
end $$;
do $$
begin
  insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps, annonce_id)
  values ('a0420000-0000-0000-0000-00000000000b', 'client', 'a0420000-0000-0000-0000-00000000000b', false,
          'Je reponds a une annonce que je n''ai pas recue', 'a0420000-0000-0000-0000-0000000000a1');
  raise exception 'ECHEC 0042 : un client repond a une annonce qui ne lui etait pas destinee';
exception when insufficient_privilege then
  raise notice 'OK    0042 : on ne repond qu''a ses propres annonces';
end $$;
do $$
begin
  update public.fil_equipe set corps = 'Modifie';
  if exists (select 1 from public.fil_equipe where corps = 'Modifie') then
    raise exception 'ECHEC 0042 : un message du fil se modifie';
  end if;
  raise notice 'OK    0042 : un message du fil ne se modifie pas';
end $$;

-- D ne voit rien du fil de K ; ni la boîte de l'équipe.
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select pg_temp.check('0042 : D ne voit pas le fil de K', (select count(*) from public.fil_equipe) = 0);
select pg_temp.check('0042 : la boite de l''equipe est vide hors equipe', (select count(*) from public.boite_equipe()) = 0);
select public.marquer_fil_lu_par_l_equipe('a0420000-0000-0000-0000-00000000000b', 'client');

-- L'équipe voit le message, toujours non lu (D n'a rien pu marquer), et répond.
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0042 : l''equipe voit le fil de K, non lu',
  (select count(*) from public.boite_equipe()
    where fil_de = 'a0420000-0000-0000-0000-00000000000b' and nom = 'Client K' and non_lus = 1) = 1);
select public.marquer_fil_lu_par_l_equipe('a0420000-0000-0000-0000-00000000000b', 'client');
select pg_temp.check('0042 : ouvert par l''equipe, le fil est lu',
  (select non_lus from public.boite_equipe() where fil_de = 'a0420000-0000-0000-0000-00000000000b') = 0);
insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
values ('a0420000-0000-0000-0000-00000000000b', 'client', 'a0420000-0000-0000-0000-000000000005', true, 'Avec plaisir');

-- K lit la réponse.
select pg_temp.login('a0420000-0000-0000-0000-00000000000b');
select pg_temp.check('0042 : K voit la reponse de l''equipe',
  (select count(*) from public.fil_equipe where de_l_equipe) = 1);
select public.marquer_fil_equipe_lu('client');
select public.marquer_annonces_lues('client');
select pg_temp.check('0042 : K a tout lu',
  not exists (select 1 from public.fil_equipe where de_l_equipe and lu_at is null)
  and not exists (select 1 from public.annonce_destinataires where lue_at is null));
reset role;

-- Une personne suspendue lit, mais n'écrit plus.
update public.profiles set is_suspended = true, suspended_at = now()
 where auth_user_id = '44444444-4444-4444-4444-444444444444';
set role authenticated;
select pg_temp.login('44444444-4444-4444-4444-444444444444');
select pg_temp.check('0042 : suspendu, D lit encore l''annonce a tous',
  (select count(*) from public.annonces) = 1);
do $$
begin
  insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
  values ('44444444-4444-4444-4444-444444444444', 'client', '44444444-4444-4444-4444-444444444444', false, 'Suspendu');
  raise exception 'ECHEC 0042 : une personne suspendue ecrit a l''equipe';
exception when insufficient_privilege then
  raise notice 'OK    0042 : une personne suspendue n''ecrit plus a l''equipe';
end $$;
reset role;
update public.profiles set is_suspended = false, suspended_at = null
 where auth_user_id = '44444444-4444-4444-4444-444444444444';

select pg_temp.check('0042 : les fonctions de l''equipe sont fermees a anon',
  not has_function_privilege('anon', 'public.je_suis_de_l_equipe()', 'execute')
  and not has_function_privilege('anon', 'public.boite_equipe()', 'execute')
  and not has_function_privilege('anon', 'public.marquer_fil_lu_par_l_equipe(uuid, public.user_role)', 'execute')
  and not has_function_privilege('authenticated', 'public.annonce_fixer_destinataires()', 'execute'));

-- =====================================================================
-- Un membre de l'équipe ne voit que l'espace de l'équipe (0043)
-- =====================================================================
-- S est dans l'équipe depuis 0042 : la migration l'a marqué au passage.
select pg_temp.check('0043 : un membre de l''equipe est marque sur sa connexion',
  (select raw_app_meta_data ->> 'equipe' from auth.users where id = 'a0420000-0000-0000-0000-000000000005') = 'true');

-- Entrer dans l'équipe marque ; en sortir démarque.
insert into public.equipe (auth_user_id, nom) values ('44444444-4444-4444-4444-444444444444', 'D');
select pg_temp.check('0043 : entrer dans l''equipe marque la connexion',
  (select raw_app_meta_data ->> 'equipe' from auth.users where id = '44444444-4444-4444-4444-444444444444') = 'true');

-- Une annonce publiée maintenant n'atteint pas l'équipe.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
insert into public.annonces (id, auteur_id, titre, corps, public, etat) values
  ('a0430000-0000-0000-0000-0000000000a1', 'a0420000-0000-0000-0000-000000000005', 'Apres 0043', 'Bonjour', 'tous', 'publiee');
reset role;
select pg_temp.check('0043 : une annonce ne part pas vers l''equipe',
  not exists (select 1 from public.annonce_destinataires
               where annonce_id = 'a0430000-0000-0000-0000-0000000000a1'
                 and auth_user_id in ('a0420000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444'))
  and exists (select 1 from public.annonce_destinataires
               where annonce_id = 'a0430000-0000-0000-0000-0000000000a1'
                 and auth_user_id = '33333333-3333-3333-3333-333333333333'));

delete from public.equipe where auth_user_id = '44444444-4444-4444-4444-444444444444';
select pg_temp.check('0043 : sortir de l''equipe retire la marque, et elle seule',
  (select not (raw_app_meta_data ? 'equipe') from auth.users where id = '44444444-4444-4444-4444-444444444444'));

-- Personne ne se marque soi-même : ni `equipe` ni `auth.users` ne
-- s'écrivent depuis un écran.
set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');
do $$
begin
  update auth.users set raw_app_meta_data = '{"equipe": true}' where id = '33333333-3333-3333-3333-333333333333';
  raise exception 'ECHEC 0043 : un client se marque lui-meme membre de l''equipe';
exception when insufficient_privilege then
  raise notice 'OK    0043 : un client ne peut pas se marquer membre de l''equipe';
end $$;
reset role;
select pg_temp.check('0043 : la fonction de marquage n''est appelable par personne',
  not has_function_privilege('authenticated', 'public.equipe_marquer_la_connexion()', 'execute')
  and not has_function_privilege('anon', 'public.equipe_marquer_la_connexion()', 'execute'));

-- =====================================================================
-- Chaque espace a son propre fil avec l'équipe (0044)
-- =====================================================================
-- C a un compte client ET une boutique (comptes liés, plus haut).
set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');
insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
values ('33333333-3333-3333-3333-333333333333', 'client', '33333333-3333-3333-3333-333333333333', false, 'Plainte contre une boutique');
insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
values ('33333333-3333-3333-3333-333333333333', 'merchant', '33333333-3333-3333-3333-333333333333', false, 'Probleme avec ma boutique');
select pg_temp.check('0044 : les deux espaces de C ont chacun leur fil',
  (select count(*) from public.fil_equipe where fil_de = '33333333-3333-3333-3333-333333333333' and espace = 'client') = 1
  and (select count(*) from public.fil_equipe where fil_de = '33333333-3333-3333-3333-333333333333' and espace = 'merchant') = 1);
do $$
begin
  insert into public.fil_equipe (fil_de, auteur_id, de_l_equipe, corps)
  values ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', false, 'Sans espace');
  raise exception 'ECHEC 0044 : un message sans espace est accepte';
-- Le RLS refuse avant même la contrainte NOT NULL : les deux disent non.
exception when not_null_violation or insufficient_privilege then
  raise notice 'OK    0044 : un message appartient toujours a un espace';
end $$;

-- K n'a qu'un compte client : il n'écrit pas côté boutique.
select pg_temp.login('a0420000-0000-0000-0000-00000000000b');
do $$
begin
  insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps)
  values ('a0420000-0000-0000-0000-00000000000b', 'merchant', 'a0420000-0000-0000-0000-00000000000b', false, 'Boutique fantome');
  raise exception 'ECHEC 0044 : on ecrit depuis un espace qu''on n''a pas';
exception when insufficient_privilege then
  raise notice 'OK    0044 : on n''ecrit que depuis un espace qu''on possede';
end $$;
reset role;

-- Une annonce aux clients ne se répond pas depuis la boutique.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
insert into public.annonces (id, auteur_id, titre, corps, public, etat) values
  ('a0440000-0000-0000-0000-0000000000a1', 'a0420000-0000-0000-0000-000000000005', 'Aux clients', 'Bonjour', 'clients', 'publiee');
select pg_temp.login('33333333-3333-3333-3333-333333333333');
do $$
begin
  insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps, annonce_id)
  values ('33333333-3333-3333-3333-333333333333', 'merchant', '33333333-3333-3333-3333-333333333333', false,
          'Je reponds cote boutique', 'a0440000-0000-0000-0000-0000000000a1');
  raise exception 'ECHEC 0044 : une annonce aux clients se repond depuis la boutique';
exception when insufficient_privilege then
  raise notice 'OK    0044 : une annonce ne se repond que depuis l''espace qu''elle concerne';
end $$;
insert into public.fil_equipe (fil_de, espace, auteur_id, de_l_equipe, corps, annonce_id)
values ('33333333-3333-3333-3333-333333333333', 'client', '33333333-3333-3333-3333-333333333333', false,
        'Je reponds cote client', 'a0440000-0000-0000-0000-0000000000a1');

-- Lire côté boutique ne marque pas l'annonce aux clients.
select public.marquer_annonces_lues('merchant');
select pg_temp.check('0044 : lire cote boutique laisse non lue l''annonce aux clients',
  (select lue_at is null from public.annonce_destinataires
    where annonce_id = 'a0440000-0000-0000-0000-0000000000a1' and auth_user_id = '33333333-3333-3333-3333-333333333333'));
reset role;

-- L'équipe voit deux fils pour C, et marque lu l'un sans l'autre.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0044 : la boite montre un fil par espace',
  (select count(*) from public.boite_equipe() where fil_de = '33333333-3333-3333-3333-333333333333') = 2);
-- Le compte commerçant de C n'a pas encore de boutique : le nom du
-- compte s'affiche (avec une boutique, c'est son nom qui s'afficherait).
select pg_temp.check('0044 : cote boutique, la boite nomme le compte commercant',
  (select nom from public.boite_equipe() where fil_de = '33333333-3333-3333-3333-333333333333' and espace = 'merchant') = 'Client C');
select public.marquer_fil_lu_par_l_equipe('33333333-3333-3333-3333-333333333333', 'merchant');
select pg_temp.check('0044 : lu cote boutique, le fil client reste non lu',
  (select non_lus from public.boite_equipe() where fil_de = '33333333-3333-3333-3333-333333333333' and espace = 'merchant') = 0
  and (select non_lus from public.boite_equipe() where fil_de = '33333333-3333-3333-3333-333333333333' and espace = 'client') = 2);
reset role;
select pg_temp.check('0044 : les anciennes fonctions sans espace n''existent plus',
  to_regprocedure('public.marquer_fil_equipe_lu()') is null
  and to_regprocedure('public.marquer_annonces_lues()') is null
  and to_regprocedure('public.marquer_fil_lu_par_l_equipe(uuid)') is null);

-- =====================================================================
-- L'équipe gère ses annonces (0045)
-- =====================================================================
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
insert into public.annonces (id, auteur_id, titre, corps, public) values
  ('a0450000-0000-0000-0000-0000000000b1', 'a0420000-0000-0000-0000-000000000005', 'Brouillon', 'En preparation', 'tous');
select pg_temp.check('0045 : une annonce part en brouillon par defaut, sans destinataires',
  (select etat = 'brouillon' and publiee_at is null from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.annonce_destinataires where annonce_id = 'a0450000-0000-0000-0000-0000000000b1'));
reset role;

-- Un utilisateur ne voit pas le brouillon.
set role authenticated;
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select pg_temp.check('0045 : un brouillon est invisible pour les utilisateurs',
  not exists (select 1 from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1'));
do $$
begin
  update public.annonces set titre = 'Pirate' where id = 'a0420000-0000-0000-0000-0000000000a2';
  if exists (select 1 from public.annonces where titre = 'Pirate') then
    raise exception 'ECHEC 0045 : un client modifie une annonce';
  end if;
  raise notice 'OK    0045 : un client ne modifie pas une annonce';
end $$;
reset role;

-- Un inscrit APRÈS la création du brouillon mais AVANT sa publication la reçoit.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0450000-0000-0000-0000-00000000000e', 'e0045@test.gn', '{"role":"client","full_name":"Client E45","phone":"620004501"}');
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
update public.annonces set etat = 'publiee' where id = 'a0450000-0000-0000-0000-0000000000b1';
select pg_temp.check('0045 : publier fige les destinataires au moment de la publication',
  (select publiee_at is not null from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1')
  and exists (select 1 from public.annonce_destinataires
               where annonce_id = 'a0450000-0000-0000-0000-0000000000b1' and auth_user_id = 'a0450000-0000-0000-0000-00000000000e'));

-- Modifier une annonce publiée : signée, datée, sans changer de public.
update public.annonces set corps = 'Texte corrige' where id = 'a0450000-0000-0000-0000-0000000000b1';
select pg_temp.check('0045 : une modification est datee et signee',
  (select modifiee_at is not null and modifiee_par = 'a0420000-0000-0000-0000-000000000005'
     from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1'));
do $$
begin
  update public.annonces set public = 'clients' where id = 'a0450000-0000-0000-0000-0000000000b1';
  raise exception 'ECHEC 0045 : une annonce publiee change de public';
exception when raise_exception then
  raise notice 'OK    0045 : une annonce publiee garde son public';
end $$;
do $$
begin
  update public.annonces set etat = 'brouillon' where id = 'a0450000-0000-0000-0000-0000000000b1';
  raise exception 'ECHEC 0045 : une annonce publiee redevient un brouillon';
exception when raise_exception then
  raise notice 'OK    0045 : une annonce publiee ne redevient pas un brouillon';
end $$;
do $$
begin
  update public.annonces set auteur_id = '33333333-3333-3333-3333-333333333333' where id = 'a0450000-0000-0000-0000-0000000000b1';
  if (select auteur_id from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1') <> 'a0420000-0000-0000-0000-000000000005' then
    raise exception 'ECHEC 0045 : l''auteur d''une annonce se reecrit';
  end if;
  raise notice 'OK    0045 : l''auteur d''une annonce ne se reecrit pas';
end $$;

-- Une annonce publiée ne se supprime pas : elle se retire.
delete from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1';
select pg_temp.check('0045 : une annonce publiee ne se supprime pas',
  exists (select 1 from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1'));
update public.annonces set etat = 'retiree' where id = 'a0450000-0000-0000-0000-0000000000b1';
select pg_temp.check('0045 : un retrait est date et signe',
  (select retiree_at is not null and retiree_par = 'a0420000-0000-0000-0000-000000000005'
     from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1'));
do $$
begin
  update public.annonces set etat = 'publiee' where id = 'a0450000-0000-0000-0000-0000000000b1';
  raise exception 'ECHEC 0045 : une annonce retiree se republie';
exception when raise_exception then
  raise notice 'OK    0045 : une annonce retiree ne se modifie plus';
end $$;
reset role;
set role authenticated;
select pg_temp.login('a0450000-0000-0000-0000-00000000000e');
select pg_temp.check('0045 : une annonce retiree disparait chez ses destinataires',
  not exists (select 1 from public.annonces where id = 'a0450000-0000-0000-0000-0000000000b1'));
reset role;

-- Programmer : pas pour aujourd'hui ; publiée par le passage du matin.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
do $$
begin
  insert into public.annonces (auteur_id, titre, corps, public, etat, programmee_pour)
  values ('a0420000-0000-0000-0000-000000000005', 'Hier', 'Trop tard', 'tous', 'programmee', current_date);
  raise exception 'ECHEC 0045 : une annonce se programme pour aujourd''hui';
exception when raise_exception then
  raise notice 'OK    0045 : une annonce se programme a partir de demain';
end $$;
insert into public.annonces (id, auteur_id, titre, corps, public, etat, programmee_pour) values
  ('a0450000-0000-0000-0000-0000000000c1', 'a0420000-0000-0000-0000-000000000005', 'Demain', 'Bonjour demain', 'clients', 'programmee', current_date + 1);
select pg_temp.check('0045 : publier_annonces_programmees est fermee a l''equipe',
  not has_function_privilege('authenticated', 'public.publier_annonces_programmees()', 'execute'));
reset role;
-- Le lendemain : on simule le passage du matin en avançant la date prévue.
alter table public.annonces disable trigger annonces_tenir_le_cycle;
update public.annonces set programmee_pour = current_date where id = 'a0450000-0000-0000-0000-0000000000c1';
alter table public.annonces enable trigger annonces_tenir_le_cycle;
-- Publier, puis vérifier : une même instruction ne verrait pas son propre changement.
create temp table publiees_ce_matin as select * from public.publier_annonces_programmees() as id;
select pg_temp.check('0045 : le passage du matin publie ce qui est programme pour le jour',
  (select count(*) from publiees_ce_matin where id = 'a0450000-0000-0000-0000-0000000000c1') = 1
  and (select etat = 'publiee' and publiee_at is not null from public.annonces where id = 'a0450000-0000-0000-0000-0000000000c1')
  and exists (select 1 from public.annonce_destinataires where annonce_id = 'a0450000-0000-0000-0000-0000000000c1'));

-- Qui l'a lue : pour l'équipe seulement.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0045 : l''equipe voit qui a recu l''annonce',
  (select count(*) from public.lecteurs_annonce('a0450000-0000-0000-0000-0000000000c1')) > 0);
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select pg_temp.check('0045 : un client ne voit pas les lecteurs',
  (select count(*) from public.lecteurs_annonce('a0450000-0000-0000-0000-0000000000c1')) = 0);
reset role;

-- Un brouillon se supprime.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
insert into public.annonces (id, auteur_id, titre, corps, public) values
  ('a0450000-0000-0000-0000-0000000000d1', 'a0420000-0000-0000-0000-000000000005', 'A jeter', 'Brouillon', 'tous');
delete from public.annonces where id = 'a0450000-0000-0000-0000-0000000000d1';
select pg_temp.check('0045 : un brouillon se supprime',
  not exists (select 1 from public.annonces where id = 'a0450000-0000-0000-0000-0000000000d1'));
reset role;

-- =====================================================================
-- L'équipe modère et garde un historique (0046)
-- =====================================================================
-- S (équipe, 0042). M : commerçant, boutique « Chez M46 », deux produits
-- publiés (P1 sera signalé et masqué par l'équipe, P2 reste au
-- commerçant). N : client qui écrit à M, puis signale P1 et le fil.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0460000-0000-0000-0000-00000000000a', 'm0046@test.gn', '{"role":"merchant","full_name":"Marchand M","phone":"620004601"}'),
  ('a0460000-0000-0000-0000-00000000000c', 'n0046@test.gn', '{"role":"client","full_name":"Client N","phone":"620004602"}');
update public.profiles set id = auth_user_id
 where auth_user_id in ('a0460000-0000-0000-0000-00000000000a', 'a0460000-0000-0000-0000-00000000000c');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0460000-0000-0000-0000-0000000000b1', 'a0460000-0000-0000-0000-00000000000a', 'Chez M46', 1);
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0460000-0000-0000-0000-0000000000f1', 'a0460000-0000-0000-0000-0000000000b1', 1, 'Telephone douteux', 100000, 'draft'),
  ('a0460000-0000-0000-0000-0000000000f2', 'a0460000-0000-0000-0000-0000000000b1', 1, 'Pagne honnete', 50000, 'draft');
insert into public.product_images (product_id, storage_path, position) values
  ('a0460000-0000-0000-0000-0000000000f1', 'a0460000/f1/0.webp', 0),
  ('a0460000-0000-0000-0000-0000000000f2', 'a0460000/f2/0.webp', 0);
update public.products set status = 'active'
 where id in ('a0460000-0000-0000-0000-0000000000f1', 'a0460000-0000-0000-0000-0000000000f2');
insert into public.conversations (id, client_id, merchant_id) values
  ('a0460000-0000-0000-0000-0000000000c1', 'a0460000-0000-0000-0000-00000000000c', 'a0460000-0000-0000-0000-0000000000b1');
insert into public.messages (conversation_id, sender_id, product_id, body) values
  ('a0460000-0000-0000-0000-0000000000c1', 'a0460000-0000-0000-0000-00000000000c', 'a0460000-0000-0000-0000-0000000000f1', 'Il marche ?');
insert into public.messages (conversation_id, sender_id, body) values
  ('a0460000-0000-0000-0000-0000000000c1', 'a0460000-0000-0000-0000-00000000000a', 'Payez d''abord par virement');

-- Les droits : fermés à anon, ouverts à authenticated (la fonction trie).
select pg_temp.check('0046 : les fonctions de moderation sont fermees a anon, ouvertes a authenticated',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.suspendre_profil(uuid, text)', 'public.reactiver_profil(uuid, text)',
       'public.masquer_produit(uuid, text)', 'public.traiter_signalement(uuid, text)',
       'public.signalements_a_traiter()', 'public.messages_signales(uuid)',
       'public.comptes_suspendus()']) as f));
select pg_temp.check('0046 : personne n''ecrit le journal directement',
  not has_table_privilege('authenticated', 'public.journal_equipe', 'insert')
  and not has_table_privilege('authenticated', 'public.journal_equipe', 'update')
  and not has_table_privilege('authenticated', 'public.journal_equipe', 'delete')
  and not has_table_privilege('anon', 'public.journal_equipe', 'select')
  and not has_table_privilege('anon', 'public.journal_equipe', 'insert'));
select pg_temp.check('0046 : le declencheur du masquage n''est appelable par personne',
  not has_function_privilege('authenticated', 'public.produit_masque_par_equipe_reste_masque()', 'execute'));

-- N signale P1 et le fil. Il ne pose ni décision ni auteur à la place de l'équipe.
set role authenticated;
select pg_temp.login('a0460000-0000-0000-0000-00000000000c');
do $$
begin
  insert into public.reports (reporter_id, target_type, target_id, reason, decision)
  values ('a0460000-0000-0000-0000-00000000000c', 'product', 'a0460000-0000-0000-0000-0000000000f1', 'Arnaque deja classee', 'sans_suite');
  raise exception 'ECHEC 0046 : un signaleur pose lui-meme la decision';
exception when insufficient_privilege then
  raise notice 'OK    0046 : un signaleur ne pose pas la decision';
end $$;
do $$
begin
  insert into public.reports (reporter_id, target_type, target_id, reason, handled_by)
  values ('a0460000-0000-0000-0000-00000000000c', 'product', 'a0460000-0000-0000-0000-0000000000f1', 'Arnaque signee', 'a0420000-0000-0000-0000-000000000005');
  raise exception 'ECHEC 0046 : un signaleur signe au nom de l''equipe';
exception when insufficient_privilege then
  raise notice 'OK    0046 : un signaleur ne signe pas au nom de l''equipe';
end $$;
insert into public.reports (id, reporter_id, target_type, target_id, reason) values
  ('a0460000-0000-0000-0000-0000000000d1', 'a0460000-0000-0000-0000-00000000000c', 'product', 'a0460000-0000-0000-0000-0000000000f1', 'Produit contrefait'),
  ('a0460000-0000-0000-0000-0000000000d2', 'a0460000-0000-0000-0000-00000000000c', 'conversation', 'a0460000-0000-0000-0000-0000000000c1', 'Demande un virement');

-- Un client ne modère pas et ne lit rien de l'équipe.
do $$
begin
  perform public.suspendre_profil('a0460000-0000-0000-0000-00000000000a', 'Je le suspends');
  raise exception 'ECHEC 0046 : un client suspend un compte';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un client ne suspend pas';
end $$;
do $$
begin
  perform public.masquer_produit('a0460000-0000-0000-0000-0000000000f1', 'Je le masque');
  raise exception 'ECHEC 0046 : un client masque un produit';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un client ne masque pas';
end $$;
do $$
begin
  perform public.traiter_signalement('a0460000-0000-0000-0000-0000000000d1', 'sans_suite');
  raise exception 'ECHEC 0046 : un client classe un signalement';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un client ne classe pas un signalement';
end $$;
do $$
begin
  perform * from public.messages_signales('a0460000-0000-0000-0000-0000000000d2');
  raise exception 'ECHEC 0046 : un client lit un fil signale par la porte de l''equipe';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un client ne passe pas par messages_signales';
end $$;
do $$
begin
  perform * from public.signalements_a_traiter();
  raise exception 'ECHEC 0046 : un client lit la file des signalements';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un client ne lit pas la file des signalements';
end $$;
do $$
begin
  perform * from public.comptes_suspendus();
  raise exception 'ECHEC 0046 : un client lit la liste des comptes suspendus';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un client ne lit pas les comptes suspendus';
end $$;
-- Le signalement d'un autre reste invisible (C n'en voit aucun de N).
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select pg_temp.check('0046 : un utilisateur ne voit pas les signalements d''autrui',
  not exists (select 1 from public.reports where reporter_id = 'a0460000-0000-0000-0000-00000000000c'));
reset role;

-- L'équipe voit la file, avec de quoi décider.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0046 : l''equipe lit les signalements (policy de lecture)',
  (select count(*) from public.reports where reporter_id = 'a0460000-0000-0000-0000-00000000000c') = 2);
select pg_temp.check('0046 : la file nomme le produit signale et sa boutique',
  exists (select 1 from public.signalements_a_traiter() s
           where s.id = 'a0460000-0000-0000-0000-0000000000d1'
             and s.target_type = 'product' and s.reporter_nom = 'Client N'
             and s.produit_titre = 'Telephone douteux' and s.produit_status = 'active'
             and s.merchant_profile_id = 'a0460000-0000-0000-0000-00000000000a'
             and s.shop_name = 'Chez M46' and s.conv_client_profile_id is null));
select pg_temp.check('0046 : la file nomme les deux comptes d''un fil signale',
  exists (select 1 from public.signalements_a_traiter() s
           where s.id = 'a0460000-0000-0000-0000-0000000000d2'
             and s.conv_client_profile_id = 'a0460000-0000-0000-0000-00000000000c'
             and s.conv_client_nom = 'Client N'
             and s.conv_merchant_profile_id = 'a0460000-0000-0000-0000-00000000000a'
             and s.conv_shop_name = 'Chez M46' and s.produit_titre is null));
select pg_temp.check('0046 : l''equipe lit un fil signale',
  (select count(*) from public.messages_signales('a0460000-0000-0000-0000-0000000000d2')) = 2
  and exists (select 1 from public.messages_signales('a0460000-0000-0000-0000-0000000000d2')
               where body = 'Payez d''abord par virement'));
do $$
begin
  perform * from public.messages_signales('a0460000-0000-0000-0000-0000000000d1');
  raise exception 'ECHEC 0046 : un signalement de produit ouvre une conversation';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : seul un fil signale s''ouvre a l''equipe';
end $$;
select pg_temp.check('0046 : l''equipe ne lit toujours pas les conversations en direct',
  not exists (select 1 from public.messages where conversation_id = 'a0460000-0000-0000-0000-0000000000c1')
  and not exists (select 1 from public.conversations where id = 'a0460000-0000-0000-0000-0000000000c1'));

-- Classer « produit masqué » avant d'avoir masqué : refusé.
do $$
begin
  perform public.traiter_signalement('a0460000-0000-0000-0000-0000000000d1', 'produit_masque');
  raise exception 'ECHEC 0046 : « produit masque » sans masquage';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : « produit masque » exige le masquage';
end $$;
do $$
begin
  perform public.traiter_signalement('a0460000-0000-0000-0000-0000000000d1', 'oublie');
  raise exception 'ECHEC 0046 : une decision inconnue est acceptee';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : une decision inconnue est refusee';
end $$;
do $$
begin
  perform public.masquer_produit('a0460000-0000-0000-0000-0000000000f1', '  ');
  raise exception 'ECHEC 0046 : un masquage sans motif';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un masquage exige un motif';
end $$;
select public.masquer_produit('a0460000-0000-0000-0000-0000000000f1', 'Contrefacon manifeste');
-- Rappelé (essai interrompu) : sans effet, sans seconde ligne d'historique.
select public.masquer_produit('a0460000-0000-0000-0000-0000000000f1', 'Contrefacon manifeste');
reset role;
select pg_temp.check('0046 : masquer pose hidden et la case de l''equipe, une seule trace',
  (select status = 'hidden' and masque_par_equipe from public.products where id = 'a0460000-0000-0000-0000-0000000000f1')
  and (select count(*) from public.journal_equipe
        where action = 'masquer_produit' and cible_id = 'a0460000-0000-0000-0000-0000000000f1'
          and auteur = 'a0420000-0000-0000-0000-000000000005' and auteur_nom = 'S'
          and motif = 'Contrefacon manifeste') = 1);

-- Le commerçant ne republie pas un produit masqué par l'équipe…
set role authenticated;
select pg_temp.login('a0460000-0000-0000-0000-00000000000a');
do $$
begin
  update public.products set status = 'active' where id = 'a0460000-0000-0000-0000-0000000000f1';
  raise exception 'ECHEC 0046 : un commercant republie un produit masque par l''equipe (LA FAILLE)';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un commercant ne republie pas un produit masque par l''equipe';
end $$;
do $$
begin
  update public.products set masque_par_equipe = false where id = 'a0460000-0000-0000-0000-0000000000f1';
  raise exception 'ECHEC 0046 : un commercant decoche le masquage de l''equipe';
exception when insufficient_privilege then
  raise notice 'OK    0046 : un commercant ne decoche pas le masquage de l''equipe';
end $$;
-- … mais corrige encore sa fiche, et masque puis republie LUI-MÊME ses autres produits.
update public.products set title = 'Telephone corrige' where id = 'a0460000-0000-0000-0000-0000000000f1';
update public.products set status = 'hidden' where id = 'a0460000-0000-0000-0000-0000000000f2';
update public.products set status = 'active' where id = 'a0460000-0000-0000-0000-0000000000f2';
reset role;
select pg_temp.check('0046 : le commercant garde son masquage a lui et ses corrections',
  (select status = 'active' and not masque_par_equipe from public.products where id = 'a0460000-0000-0000-0000-0000000000f2')
  and (select title = 'Telephone corrige' and status = 'hidden' from public.products where id = 'a0460000-0000-0000-0000-0000000000f1'));

-- Classer le signalement du produit : signé, une seule fois.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.traiter_signalement('a0460000-0000-0000-0000-0000000000d1', 'produit_masque');
do $$
begin
  perform public.traiter_signalement('a0460000-0000-0000-0000-0000000000d1', 'sans_suite');
  raise exception 'ECHEC 0046 : un signalement se classe deux fois';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un signalement ne se classe qu''une fois';
end $$;
select pg_temp.check('0046 : un signalement classe sort de la file',
  not exists (select 1 from public.signalements_a_traiter() where id = 'a0460000-0000-0000-0000-0000000000d1'));
reset role;
select pg_temp.check('0046 : le signalement classe dit qui et quoi, l''historique aussi',
  (select handled_at is not null and handled_by = 'a0420000-0000-0000-0000-000000000005' and decision = 'produit_masque'
     from public.reports where id = 'a0460000-0000-0000-0000-0000000000d1')
  and exists (select 1 from public.journal_equipe
               where action = 'classer_signalement' and cible_type = 'signalement'
                 and cible_id = 'a0460000-0000-0000-0000-0000000000d1' and motif = 'produit_masque'));

-- Suspendre : motif obligatoire, compte suspendu une fois, notification enfilée.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
do $$
begin
  perform public.traiter_signalement('a0460000-0000-0000-0000-0000000000d2', 'compte_suspendu');
  raise exception 'ECHEC 0046 : « compte suspendu » sans suspension';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : « compte suspendu » exige la suspension';
end $$;
do $$
begin
  perform public.suspendre_profil('a0460000-0000-0000-0000-00000000000a', ' ok ');
  raise exception 'ECHEC 0046 : une suspension avec un motif trop court';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : une suspension exige un motif de 3 caracteres au moins';
end $$;
do $$
begin
  perform public.suspendre_profil('a0460000-0000-0000-0000-00000000000a', repeat('x', 501));
  raise exception 'ECHEC 0046 : une suspension avec un motif trop long';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un motif de suspension fait 500 caracteres au plus';
end $$;
select public.suspendre_profil('a0460000-0000-0000-0000-00000000000a', '  Demande de paiement hors Filloo  ');
do $$
begin
  perform public.suspendre_profil('a0460000-0000-0000-0000-00000000000a', 'Encore une fois');
  raise exception 'ECHEC 0046 : un compte se suspend deux fois';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : un compte deja suspendu ne se resuspend pas';
end $$;
select public.traiter_signalement('a0460000-0000-0000-0000-0000000000d2', 'compte_suspendu');
select pg_temp.check('0046 : la liste de reactivation montre le compte, sa boutique et son motif',
  exists (select 1 from public.comptes_suspendus()
           where profile_id = 'a0460000-0000-0000-0000-00000000000a' and role = 'merchant'
             and nom = 'Marchand M' and shop_name = 'Chez M46'
             and suspension_reason = 'Demande de paiement hors Filloo'));
reset role;
select pg_temp.check('0046 : suspendre pose la case, le motif nettoye et la date',
  (select is_suspended and suspension_reason = 'Demande de paiement hors Filloo' and suspended_at is not null
     from public.profiles where id = 'a0460000-0000-0000-0000-00000000000a'));
select pg_temp.check('0046 : la suspension enfile toujours la notification de 0021',
  exists (select 1 from public.notifications
           where kind = 'profile_suspended' and profile_id = 'a0460000-0000-0000-0000-00000000000a'));
select pg_temp.check('0046 : la suspension est dans l''historique avec son motif',
  exists (select 1 from public.journal_equipe
           where action = 'suspendre' and cible_type = 'profil'
             and cible_id = 'a0460000-0000-0000-0000-00000000000a'
             and motif = 'Demande de paiement hors Filloo' and auteur_nom = 'S'));

-- La personne suspendue lit son motif, ne l'efface pas, ne s'en crée pas un autre.
set role authenticated;
select pg_temp.login('a0460000-0000-0000-0000-00000000000a');
select pg_temp.check('0046 : la personne suspendue lit son motif',
  (select suspension_reason from public.profiles where id = 'a0460000-0000-0000-0000-00000000000a')
    = 'Demande de paiement hors Filloo');
do $$
begin
  update public.profiles set suspension_reason = null where id = 'a0460000-0000-0000-0000-00000000000a';
  raise exception 'ECHEC 0046 : la personne efface son motif de suspension';
exception when insufficient_privilege then
  raise notice 'OK    0046 : la personne n''ecrit pas son motif de suspension';
end $$;
do $$
begin
  update public.profiles set is_suspended = false where id = 'a0460000-0000-0000-0000-00000000000a';
  raise exception 'ECHEC 0046 : la personne leve sa propre suspension';
exception when insufficient_privilege then
  raise notice 'OK    0046 : la personne ne leve pas sa suspension';
end $$;
select pg_temp.login('a0460000-0000-0000-0000-00000000000c');
do $$
begin
  insert into public.profiles (auth_user_id, role, full_name, phone, suspension_reason)
  values ('a0460000-0000-0000-0000-00000000000c', 'merchant', 'Client N', '620004602', 'Faux motif');
  raise exception 'ECHEC 0046 : un second compte nait avec un motif de suspension';
exception when insufficient_privilege then
  raise notice 'OK    0046 : un second compte ne nait pas avec un motif de suspension';
end $$;
reset role;

-- Réactiver : motif obligatoire, efface le motif montré, une seule fois.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
do $$
begin
  perform public.reactiver_profil('a0460000-0000-0000-0000-00000000000a', null);
  raise exception 'ECHEC 0046 : une reactivation sans motif';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : une reactivation exige un motif';
end $$;
select public.reactiver_profil('a0460000-0000-0000-0000-00000000000a', 'Explications recues par telephone');
do $$
begin
  perform public.reactiver_profil('a0460000-0000-0000-0000-00000000000a', 'Encore une fois');
  raise exception 'ECHEC 0046 : un compte actif se reactive';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0046 : on ne reactive qu''un compte suspendu';
end $$;
select pg_temp.check('0046 : un compte reactive sort de la liste',
  not exists (select 1 from public.comptes_suspendus() where profile_id = 'a0460000-0000-0000-0000-00000000000a'));
-- L'historique se lit par l'équipe, ne se réécrit pas.
select pg_temp.check('0046 : l''equipe lit l''historique des cinq gestes',
  (select count(*) from public.journal_equipe
    where cible_id in ('a0460000-0000-0000-0000-00000000000a', 'a0460000-0000-0000-0000-0000000000f1',
                       'a0460000-0000-0000-0000-0000000000d1', 'a0460000-0000-0000-0000-0000000000d2')) = 5);
do $$
begin
  delete from public.journal_equipe;
  raise exception 'ECHEC 0046 : l''equipe efface l''historique';
exception when insufficient_privilege then
  raise notice 'OK    0046 : l''equipe n''efface pas l''historique';
end $$;
do $$
begin
  update public.journal_equipe set motif = 'Reecrit';
  raise exception 'ECHEC 0046 : l''equipe reecrit l''historique';
exception when insufficient_privilege then
  raise notice 'OK    0046 : l''equipe ne reecrit pas l''historique';
end $$;
do $$
begin
  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id)
  values ('a0420000-0000-0000-0000-000000000005', 'S', 'suspendre', 'profil', 'a0460000-0000-0000-0000-00000000000c');
  raise exception 'ECHEC 0046 : l''equipe ecrit une fausse ligne d''historique';
exception when insufficient_privilege then
  raise notice 'OK    0046 : l''historique ne s''ecrit que par les fonctions';
end $$;
reset role;
select pg_temp.check('0046 : reactiver efface le motif et la date, et laisse une trace',
  (select not is_suspended and suspension_reason is null and suspended_at is null
     from public.profiles where id = 'a0460000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.journal_equipe
               where action = 'reactiver' and motif = 'Explications recues par telephone'));
set role authenticated;
select pg_temp.login('a0460000-0000-0000-0000-00000000000c');
select pg_temp.check('0046 : un utilisateur ne lit pas l''historique',
  not exists (select 1 from public.journal_equipe));
reset role;

-- =====================================================================
-- Une boutique demande de la visibilité, l'équipe la valide (0047)
-- =====================================================================
-- S (équipe, 0042). G : commerçant « Chez G47 », produits g1 (cat. 1,
-- « Riz parfume »), g2 (cat. 2, « Pagne wax »), g3 (brouillon).
-- H : commerçant « Chez H47 », produits h1 et h2 (cat. 1). K : client.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0470000-0000-0000-0000-00000000000a', 'g0047@test.gn', '{"role":"merchant","full_name":"Marchand G","phone":"620004701"}'),
  ('a0470000-0000-0000-0000-00000000000b', 'h0047@test.gn', '{"role":"merchant","full_name":"Marchand H","phone":"620004702"}'),
  ('a0470000-0000-0000-0000-00000000000c', 'k0047@test.gn', '{"role":"client","full_name":"Client K47","phone":"620004703"}');
update public.profiles set id = auth_user_id
 where auth_user_id in ('a0470000-0000-0000-0000-00000000000a', 'a0470000-0000-0000-0000-00000000000b',
                        'a0470000-0000-0000-0000-00000000000c');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0470000-0000-0000-0000-0000000000a1', 'a0470000-0000-0000-0000-00000000000a', 'Chez G47', 1),
  ('a0470000-0000-0000-0000-0000000000b1', 'a0470000-0000-0000-0000-00000000000b', 'Chez H47', 1);
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0470000-0000-0000-0000-0000000000f1', 'a0470000-0000-0000-0000-0000000000a1', 1, 'Riz parfume', 300000, 'draft'),
  ('a0470000-0000-0000-0000-0000000000f2', 'a0470000-0000-0000-0000-0000000000a1', 2, 'Pagne wax', 80000, 'draft'),
  ('a0470000-0000-0000-0000-0000000000f3', 'a0470000-0000-0000-0000-0000000000a1', 1, 'Brouillon G', 1000, 'draft'),
  ('a0470000-0000-0000-0000-0000000000e1', 'a0470000-0000-0000-0000-0000000000b1', 1, 'Huile rouge', 40000, 'draft'),
  ('a0470000-0000-0000-0000-0000000000e2', 'a0470000-0000-0000-0000-0000000000b1', 1, 'Sel fin', 5000, 'draft');
insert into public.product_images (product_id, storage_path, position) values
  ('a0470000-0000-0000-0000-0000000000f1', 'a0470000/f1/0.webp', 0),
  ('a0470000-0000-0000-0000-0000000000f2', 'a0470000/f2/0.webp', 0),
  ('a0470000-0000-0000-0000-0000000000e1', 'a0470000/e1/0.webp', 0),
  ('a0470000-0000-0000-0000-0000000000e2', 'a0470000/e2/0.webp', 0);
update public.products set status = 'active'
 where id in ('a0470000-0000-0000-0000-0000000000f1', 'a0470000-0000-0000-0000-0000000000f2',
              'a0470000-0000-0000-0000-0000000000e1', 'a0470000-0000-0000-0000-0000000000e2');

-- Depuis 0048, les campagnes ont un prix : cette section rejoue le chemin
-- GRATUIT de 0047 (tarifs à 0). Les tarifs d'origine, gardés en tête
-- de fichier, sont remis dans la section 0048.
insert into public.tarifs_publicite (type, duree_jours, prix_gnf) select type, duree_jours, 0 from tarifs_origine;

-- Les droits.
select pg_temp.check('0047 : les fonctions de campagne sont fermees a anon, ouvertes a authenticated',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.demander_campagne(text, uuid, int, int)', 'public.annuler_campagne(uuid)',
       'public.decider_campagne(uuid, boolean, text)', 'public.interrompre_campagne(uuid, text)',
       'public.resultats_campagnes()', 'public.campagnes_equipe()']) as f));
select pg_temp.check('0047 : la vitrine sponsorisee est ouverte a anon et authenticated',
  (select bool_and(has_function_privilege('anon', f, 'execute')
                   and has_function_privilege('authenticated', f, 'execute'))
     from unnest(array['public.produits_sponsorises(text, int, int)',
                       'public.boutiques_mises_en_avant(int)']) as f));
select pg_temp.check('0047 : personne n''ecrit une campagne directement',
  not has_table_privilege('authenticated', 'public.campagnes', 'insert')
  and not has_table_privilege('authenticated', 'public.campagnes', 'update')
  and not has_table_privilege('authenticated', 'public.campagnes', 'delete')
  and not has_table_privilege('anon', 'public.campagnes', 'select')
  and not has_table_privilege('anon', 'public.campagnes', 'insert'));
select pg_temp.check('0047 : les contraintes du type et de la periode existent',
  (select count(*) from pg_constraint
    where conrelid = 'public.campagnes'::regclass
      and conname in ('campagnes_cible_selon_le_type', 'campagnes_active_a_une_periode',
                      'campagnes_refus_et_interruption_motives')) = 3);
do $$
begin
  insert into public.campagnes (merchant_id, type, product_id, duree_jours)
  values ('a0470000-0000-0000-0000-0000000000a1', 'boutique', 'a0470000-0000-0000-0000-0000000000f1', 7);
  raise exception 'ECHEC 0047 : une campagne boutique vise un produit';
exception when check_violation then
  raise notice 'OK    0047 : une campagne boutique ne vise pas de produit (contrainte)';
end $$;
do $$
begin
  insert into public.campagnes (merchant_id, type, product_id, duree_jours, statut)
  values ('a0470000-0000-0000-0000-0000000000a1', 'produit', 'a0470000-0000-0000-0000-0000000000f1', 7, 'active');
  raise exception 'ECHEC 0047 : une campagne active sans periode';
exception when check_violation then
  raise notice 'OK    0047 : une campagne active a une periode (contrainte)';
end $$;

-- Un client ne demande pas de campagne.
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000c');
do $$
begin
  perform public.demander_campagne('boutique', null, null, 7);
  raise exception 'ECHEC 0047 : un client demande une campagne';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : un client ne demande pas de campagne';
end $$;

-- G : demandes refusées.
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
do $$
begin
  perform public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000e1', null, 7);
  raise exception 'ECHEC 0047 : une boutique sponsorise le produit d''une autre';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : on ne sponsorise que son propre produit';
end $$;
do $$
begin
  perform public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f3', null, 7);
  raise exception 'ECHEC 0047 : un brouillon est sponsorise';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : on ne sponsorise qu''un produit publie';
end $$;
do $$
begin
  perform public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f1', null, 5);
  raise exception 'ECHEC 0047 : une duree hors liste';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : la duree est 3, 7, 14 ou 30 jours';
end $$;
do $$
begin
  perform public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f1', 1, 7);
  raise exception 'ECHEC 0047 : une campagne produit avec une categorie';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une campagne produit ne vise pas de categorie';
end $$;
do $$
begin
  perform public.demander_campagne('categorie', 'a0470000-0000-0000-0000-0000000000f1', null, 7);
  raise exception 'ECHEC 0047 : une campagne categorie sans categorie';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une campagne categorie exige sa categorie';
end $$;
do $$
begin
  perform public.demander_campagne('categorie', 'a0470000-0000-0000-0000-0000000000f1', 999, 7);
  raise exception 'ECHEC 0047 : une categorie inexistante';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : la categorie doit exister';
end $$;
do $$
begin
  perform public.demander_campagne('boutique', 'a0470000-0000-0000-0000-0000000000f1', null, 7);
  raise exception 'ECHEC 0047 : une campagne boutique avec un produit';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une campagne boutique ne vise ni produit ni categorie';
end $$;
do $$
begin
  perform public.demander_campagne(p_type => 'produit', p_product => 'a0470000-0000-0000-0000-0000000000f1');
  raise exception 'ECHEC 0047 : une demande sans duree';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une demande sans duree est refusee';
end $$;
do $$
begin
  perform public.demander_campagne('vitrine', null, null, 7);
  raise exception 'ECHEC 0047 : un type inconnu';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : un type inconnu est refuse';
end $$;

-- G : trois demandes acceptées par la base, un doublon refusé.
create temp table t47 (nom text primary key, id uuid);
grant all on t47 to authenticated, anon;
insert into t47 select 'g_produit', public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f1', null, 7);
do $$
begin
  perform public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f1', null, 30);
  raise exception 'ECHEC 0047 : deux campagnes identiques en attente';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : pas deux campagnes identiques en attente';
end $$;
insert into t47 select 'g_categorie_refusee', public.demander_campagne('categorie', 'a0470000-0000-0000-0000-0000000000f1', 1, 14);
-- Le site omet p_product et p_category quand ils ne servent pas (défauts null).
insert into t47 select 'g_boutique', public.demander_campagne(p_type => 'boutique', p_duree => 3);
do $$
begin
  perform public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f2', null, 7);
  raise exception 'ECHEC 0047 : une quatrieme campagne en meme temps';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : trois campagnes au plus en meme temps';
end $$;
do $$
begin
  insert into public.campagnes (merchant_id, type, duree_jours)
  values ('a0470000-0000-0000-0000-0000000000a1', 'boutique', 30);
  raise exception 'ECHEC 0047 : un commercant ecrit une campagne directement';
exception when insufficient_privilege then
  raise notice 'OK    0047 : un commercant n''ecrit pas une campagne directement';
end $$;
do $$
begin
  update public.campagnes set statut = 'active', debut_at = now(), fin_at = now() + interval '30 days';
  raise exception 'ECHEC 0047 : un commercant active lui-meme sa campagne';
exception when insufficient_privilege then
  raise notice 'OK    0047 : un commercant n''active pas sa campagne';
end $$;
do $$
begin
  perform public.decider_campagne((select id from t47 where nom = 'g_produit'), true, null);
  raise exception 'ECHEC 0047 : un commercant valide sa campagne';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : un commercant ne valide pas sa campagne';
end $$;
do $$
begin
  perform * from public.campagnes_equipe();
  raise exception 'ECHEC 0047 : un commercant lit la file de l''equipe';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : un commercant ne lit pas la file de l''equipe';
end $$;
select pg_temp.check('0047 : la boutique lit ses trois campagnes, en attente',
  (select count(*) from public.campagnes where statut = 'en_attente') = 3);

-- H ne voit ni n'annule les campagnes de G.
select pg_temp.login('a0470000-0000-0000-0000-00000000000b');
select pg_temp.check('0047 : une boutique ne lit pas les campagnes d''une autre',
  not exists (select 1 from public.campagnes));
do $$
begin
  perform public.annuler_campagne((select id from t47 where nom = 'g_boutique'));
  raise exception 'ECHEC 0047 : une boutique annule la campagne d''une autre';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une boutique n''annule pas la campagne d''une autre';
end $$;
insert into t47 select 'h_1', public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000e1', null, 7);
insert into t47 select 'h_2', public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000e2', null, 7);
reset role;

-- Avant validation, rien n'est montré.
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0047 : une campagne en attente n''est pas montree',
  not exists (select 1 from public.produits_sponsorises(null, null, 4))
  and not exists (select 1 from public.boutiques_mises_en_avant(12)));
reset role;

-- L'équipe juge.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0047 : l''equipe lit toutes les campagnes (policy)',
  (select count(*) from public.campagnes c join t47 on t47.id = c.id) = 5);
select pg_temp.check('0047 : la file de l''equipe nomme le produit, la boutique, la categorie',
  exists (select 1 from public.campagnes_equipe() ce
           where ce.id = (select id from t47 where nom = 'g_categorie_refusee')
             and ce.type = 'categorie' and ce.statut = 'en_attente' and ce.duree_jours = 14
             and ce.shop_name = 'Chez G47' and ce.produit_titre = 'Riz parfume'
             and ce.category_id = 1 and ce.category_name is not null
             and ce.merchant_id = 'a0470000-0000-0000-0000-0000000000a1'));
do $$
begin
  perform public.decider_campagne((select id from t47 where nom = 'g_categorie_refusee'), false, ' no ');
  raise exception 'ECHEC 0047 : un refus sans vrai motif';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : un refus exige un motif de 3 caracteres';
end $$;
select public.decider_campagne((select id from t47 where nom = 'g_categorie_refusee'), false, '  Photo floue  ');
do $$
begin
  perform public.decider_campagne((select id from t47 where nom = 'g_categorie_refusee'), true, null);
  raise exception 'ECHEC 0047 : une campagne refusee est validee ensuite';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une campagne ne se decide qu''une fois';
end $$;
select public.decider_campagne((select id from t47 where nom = 'g_produit'), true, null);
select public.decider_campagne((select id from t47 where nom = 'g_boutique'), true, null);
-- Le site omet p_motif pour une validation (défaut null).
select public.decider_campagne(p_id => (select id from t47 where nom = 'h_1'), p_accepter => true);
select public.decider_campagne((select id from t47 where nom = 'h_2'), true, null);
reset role;
select pg_temp.check('0047 : un refus pose le statut, le motif nettoye et la signature',
  (select statut = 'refusee' and motif = 'Photo floue' and decidee_par = 'a0420000-0000-0000-0000-000000000005'
          and decidee_at is not null and debut_at is null
     from public.campagnes where id = (select id from t47 where nom = 'g_categorie_refusee')));
select pg_temp.check('0047 : une validation ouvre la periode de sa duree',
  (select statut = 'active' and fin_at - debut_at = interval '7 days' and debut_at <= now()
          and decidee_par = 'a0420000-0000-0000-0000-000000000005'
     from public.campagnes where id = (select id from t47 where nom = 'g_produit')));
select pg_temp.check('0047 : valider et refuser sont dans l''historique',
  (select count(*) from public.journal_equipe
    where cible_type = 'campagne' and auteur_nom = 'S'
      and ((action = 'refuser_campagne' and motif = 'Photo floue'
            and cible_id = (select id from t47 where nom = 'g_categorie_refusee'))
        or (action = 'valider_campagne' and cible_id = (select id from t47 where nom = 'g_produit')))) = 2);

-- G, débloqué par le refus, demande une promotion de g2 dans la catégorie 3.
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
insert into t47 select 'g_categorie', public.demander_campagne('categorie', 'a0470000-0000-0000-0000-0000000000f2', 3, 7);
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_campagne((select id from t47 where nom = 'g_categorie'), true, null);
reset role;

-- Ce que voit un visiteur.
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0047 : l''accueil montre un produit sponsorise par boutique',
  (select count(*) from public.produits_sponsorises(null, null, 10)) = 2
  and (select count(distinct merchant_id) from public.produits_sponsorises(null, null, 10)) = 2);
select pg_temp.check('0047 : le produit sponsorise porte sa campagne et les colonnes de la recherche',
  exists (select 1 from public.produits_sponsorises(null, null, 4) s
           where s.product_id = 'a0470000-0000-0000-0000-0000000000f1'
             and s.campagne_id = (select id from t47 where nom = 'g_produit')
             and s.shop_name = 'Chez G47' and s.title = 'Riz parfume' and s.status = 'active'
             and s.image_path = 'a0470000/f1/0.webp' and s.city_name is not null));
select pg_temp.check('0047 : une campagne categorie ne sort pas hors de sa categorie',
  not exists (select 1 from public.produits_sponsorises(null, null, 4)
               where campagne_id = (select id from t47 where nom = 'g_categorie')));
select pg_temp.check('0047 : une campagne categorie sort dans sa categorie',
  (select array_agg(campagne_id) from public.produits_sponsorises(null, 3, 4))
    = array[(select id from t47 where nom = 'g_categorie')]);
select pg_temp.check('0047 : une campagne produit sort dans la categorie du produit, pas ailleurs',
  exists (select 1 from public.produits_sponsorises(null, 1, 4) where product_id = 'a0470000-0000-0000-0000-0000000000f1')
  and not exists (select 1 from public.produits_sponsorises(null, 2, 4)));
select pg_temp.check('0047 : la recherche ne sponsorise que les produits pertinents',
  (select array_agg(product_id) from public.produits_sponsorises('riz parfumé', null, 4))
    = array['a0470000-0000-0000-0000-0000000000f1'::uuid]
  and not exists (select 1 from public.produits_sponsorises('introuvable zz', null, 4)));
select pg_temp.check('0047 : meme verdict texte que search_products',
  not exists (
    select 1 from public.produits_sponsorises('chez h47', null, 4) s
     where s.product_id not in (select product_id from public.search_products('chez h47', null, null, 'recent', 50, 0)))
  and exists (select 1 from public.produits_sponsorises('chez h47', null, 4)));
select pg_temp.check('0047 : le plafond de 4 tient',
  (select count(*) from public.produits_sponsorises(null, 1, 100)) <= 4
  and (select count(*) from public.produits_sponsorises(null, null, -3)) = 0);
select pg_temp.check('0047 : la boutique mise en avant et ses produits actifs',
  (select array_agg(merchant_id::text || ':' || produits_actifs || ':' || shop_name)
     from public.boutiques_mises_en_avant(12))
    = array['a0470000-0000-0000-0000-0000000000a1:2:Chez G47']);
reset role;

-- Les règles du catalogue coupent la publicité, sans geste de plus.
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
update public.products set status = 'hidden' where id = 'a0470000-0000-0000-0000-0000000000f2';
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0047 : un produit masque par son commercant n''est plus sponsorise',
  not exists (select 1 from public.produits_sponsorises(null, 3, 4))
  and (select produits_actifs from public.boutiques_mises_en_avant(12)) = 1);
reset role;
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
update public.products set status = 'active' where id = 'a0470000-0000-0000-0000-0000000000f2';
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.suspendre_profil('a0470000-0000-0000-0000-00000000000a', 'Essai de suspension 0047');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0047 : une boutique suspendue perd toute sa publicite',
  not exists (select 1 from public.produits_sponsorises(null, null, 4) where merchant_id = 'a0470000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.produits_sponsorises(null, 3, 4))
  and not exists (select 1 from public.boutiques_mises_en_avant(12)));
select pg_temp.check('0047 : les autres boutiques restent sponsorisees',
  exists (select 1 from public.produits_sponsorises(null, null, 4) where merchant_id = 'a0470000-0000-0000-0000-0000000000b1'));
reset role;
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.reactiver_profil('a0470000-0000-0000-0000-00000000000a', 'Fin de l''essai 0047');
select public.masquer_produit('a0470000-0000-0000-0000-0000000000e1', 'Essai de masquage 0047');
select public.masquer_produit('a0470000-0000-0000-0000-0000000000e2', 'Essai de masquage 0047');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0047 : un produit masque par l''equipe n''est plus sponsorise',
  not exists (select 1 from public.produits_sponsorises(null, null, 4) where merchant_id = 'a0470000-0000-0000-0000-0000000000b1')
  and exists (select 1 from public.produits_sponsorises(null, null, 4) where merchant_id = 'a0470000-0000-0000-0000-0000000000a1'));
reset role;

-- Une campagne terminée (fin passée) n'est plus montrée, et se redemande.
update public.campagnes set debut_at = now() - interval '8 days', fin_at = now() - interval '1 day'
 where id = (select id from t47 where nom = 'g_boutique');
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0047 : une campagne terminee n''est plus montree',
  not exists (select 1 from public.boutiques_mises_en_avant(12)));
reset role;
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
do $$
begin
  perform public.annuler_campagne((select id from t47 where nom = 'g_boutique'));
  raise exception 'ECHEC 0047 : une campagne terminee s''annule';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une campagne terminee ne s''annule plus';
end $$;
insert into t47 select 'g_boutique_2', public.demander_campagne('boutique', null, null, 7);
-- Annuler : en attente, puis en cours.
select public.annuler_campagne((select id from t47 where nom = 'g_boutique_2'));
select public.annuler_campagne((select id from t47 where nom = 'g_categorie'));
do $$
begin
  perform public.annuler_campagne((select id from t47 where nom = 'g_categorie'));
  raise exception 'ECHEC 0047 : une campagne s''annule deux fois';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une campagne annulee ne s''annule plus';
end $$;
select pg_temp.check('0047 : annuler en attente laisse la periode vide, en cours l''arrete',
  (select statut = 'annulee' and debut_at is null and fin_at is null
     from public.campagnes where id = (select id from t47 where nom = 'g_boutique_2'))
  and (select statut = 'annulee' and fin_at <= now()
     from public.campagnes where id = (select id from t47 where nom = 'g_categorie')));
reset role;

-- L'équipe interrompt une campagne en cours.
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
do $$
begin
  perform public.interrompre_campagne((select id from t47 where nom = 'g_produit'), 'Je m''interromps');
  raise exception 'ECHEC 0047 : un commercant interrompt via la porte de l''equipe';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : un commercant n''interrompt pas';
end $$;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
do $$
begin
  perform public.interrompre_campagne((select id from t47 where nom = 'g_produit'), null);
  raise exception 'ECHEC 0047 : une interruption sans motif';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : une interruption exige un motif';
end $$;
do $$
begin
  perform public.interrompre_campagne((select id from t47 where nom = 'g_boutique'), 'Deja finie');
  raise exception 'ECHEC 0047 : une campagne terminee s''interrompt';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0047 : seule une campagne en cours s''interrompt';
end $$;
select public.interrompre_campagne((select id from t47 where nom = 'g_produit'), '  Produit trompeur  ');
reset role;
select pg_temp.check('0047 : interrompre pose le statut, le motif, arrete la periode et laisse une trace',
  (select statut = 'interrompue' and motif = 'Produit trompeur' and fin_at <= now()
     from public.campagnes where id = (select id from t47 where nom = 'g_produit'))
  and exists (select 1 from public.journal_equipe
               where action = 'interrompre_campagne' and cible_type = 'campagne'
                 and cible_id = (select id from t47 where nom = 'g_produit') and motif = 'Produit trompeur'));
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0047 : une campagne interrompue n''est plus montree',
  not exists (select 1 from public.produits_sponsorises(null, null, 4)));
reset role;

-- Les résultats : chacun les siens, l'équipe tout.
insert into public.analytics_events (name, campagne_id)
select n, (select id from t47 where nom = 'g_produit')
  from unnest(array['pub_vue', 'pub_vue', 'pub_vue', 'pub_clic']) n;
insert into public.analytics_events (name, campagne_id)
values ('pub_vue', (select id from t47 where nom = 'h_1'));
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.check('0047 : la boutique lit ses vues et clics',
  (select vues = 3 and clics = 1 from public.resultats_campagnes()
    where campagne_id = (select id from t47 where nom = 'g_produit')));
select pg_temp.check('0047 : la boutique ne lit que ses resultats, campagnes sans mesure comprises',
  (select count(*) from public.resultats_campagnes()) = 5
  and not exists (select 1 from public.resultats_campagnes()
                   where campagne_id in (select id from t47 where nom like 'h_%')));
select pg_temp.login('a0470000-0000-0000-0000-00000000000c');
select pg_temp.check('0047 : un client ne lit aucun resultat',
  not exists (select 1 from public.resultats_campagnes()));
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0047 : l''equipe lit les resultats de toutes les campagnes',
  (select count(*) from public.resultats_campagnes() r join t47 on t47.id = r.campagne_id) = 7
  and (select vues = 1 and clics = 0 from public.resultats_campagnes()
        where campagne_id = (select id from t47 where nom = 'h_1')));
reset role;

-- =====================================================================
-- Une publicité a un prix, payé à la main et vérifié par l'équipe (0048)
-- =====================================================================
-- Mêmes personnes que 0047 : G (a047…0a, boutique a1, produits f1 cat. 1
-- et f2 cat. 2), H (a047…0b, produits e1 et e2 masqués par l'équipe),
-- K client (a047…0c), S équipe (a042…05).

-- Refus attendu, avec un morceau du message quand il compte.
create or replace function pg_temp.refuse(label text, q text, attendu text default null) returns void
language plpgsql as $$
begin
  execute q;
  raise exception 'ECHEC %', label;
exception when raise_exception or insufficient_privilege or check_violation then
  if sqlerrm like 'ECHEC%' then raise; end if;
  if attendu is not null and position(attendu in sqlerrm) = 0 then
    raise exception 'ECHEC % (message recu : %)', label, sqlerrm;
  end if;
  raise notice 'OK    %', label;
end $$;

create temp table t48 (nom text primary key, id uuid);
grant all on t48 to authenticated, anon;

-- Les tarifs d'origine reviennent (0047 les avait mis à 0).
update public.tarifs_publicite t set prix_gnf = o.prix_gnf
  from tarifs_origine o where o.type = t.type and o.duree_jours = t.duree_jours;
select pg_temp.check('0048 : douze tarifs pre-remplis, aux prix du document',
  (select count(*) from public.tarifs_publicite) = 12
  and (select string_agg(type || duree_jours || '=' || prix_gnf, ',' order by type, duree_jours)
         from public.tarifs_publicite)
      = 'boutique3=10000,boutique7=20000,boutique14=35000,boutique30=60000,'
        'categorie3=5000,categorie7=10000,categorie14=18000,categorie30=32000,'
        'produit3=7000,produit7=15000,produit14=25000,produit30=45000');
select pg_temp.check('0048 : aucun moyen de paiement au depart',
  not exists (select 1 from public.moyens_paiement));

-- Les droits.
select pg_temp.check('0048 : les fonctions de prix et de paiement sont fermees a anon, ouvertes a authenticated',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.fixer_tarif(text, int, int)', 'public.fixer_moyen_paiement(text, text, text, boolean)',
       'public.declarer_paiement(uuid, text, text, text)',
       'public.creer_campagne_equipe(uuid, text, uuid, int, int, text, text)',
       'public.marquer_rembourse(uuid)', 'public.revenus_publicite()', 'public.campagnes_equipe()']) as f));
select pg_temp.check('0048 : personne n''ecrit un tarif ni un numero directement',
  (select bool_and(not has_table_privilege(r, t, p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['public.tarifs_publicite', 'public.moyens_paiement']) t,
          unnest(array['insert', 'update', 'delete', 'truncate']) p)
  and has_table_privilege('anon', 'public.tarifs_publicite', 'select')
  and not has_table_privilege('anon', 'public.moyens_paiement', 'select')
  and has_table_privilege('authenticated', 'public.moyens_paiement', 'select'));
select pg_temp.refuse('0048 : une campagne a payer a un prix (contrainte)',
  $q$insert into public.campagnes (merchant_id, type, duree_jours, statut, prix_gnf)
     values ('a0470000-0000-0000-0000-0000000000a1', 'boutique', 7, 'a_payer', 0)$q$);
select pg_temp.refuse('0048 : une campagne offerte est gratuite (contrainte)',
  $q$insert into public.campagnes (merchant_id, type, duree_jours, prix_gnf, paiement_moyen)
     values ('a0470000-0000-0000-0000-0000000000a1', 'boutique', 7, 5000, 'offert')$q$);

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0048 : un visiteur lit les prix',
  (select count(*) from public.tarifs_publicite) = 12);
select pg_temp.refuse('0048 : un visiteur ne lit pas les numeros de paiement',
  'select 1 from public.moyens_paiement');
reset role;

-- Un non-membre ne fixe rien.
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0048 : un commercant ne fixe pas un tarif',
  $q$select public.fixer_tarif('produit', 7, 1)$q$, 'équipe');
select pg_temp.refuse('0048 : un commercant ne fixe pas un numero de paiement',
  $q$select public.fixer_moyen_paiement('orange_money', '620000000', 'Escroc', true)$q$, 'équipe');
select pg_temp.refuse('0048 : un commercant n''ecrit pas un tarif directement',
  $q$update public.tarifs_publicite set prix_gnf = 1$q$);
select pg_temp.refuse('0048 : un commercant n''ecrit pas un numero directement',
  $q$insert into public.moyens_paiement (moyen, numero, titulaire, actif) values ('mtn_momo', '620000000', 'Escroc', true)$q$);
select pg_temp.check('0048 : un compte connecte lit les numeros (aucun pour l''instant)',
  not exists (select 1 from public.moyens_paiement));

-- L'équipe fixe les prix et les numéros.
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0048 : un prix au-dela de 100 000 000 est refuse',
  $q$select public.fixer_tarif('produit', 7, 100000001)$q$, '100 000 000');
select pg_temp.refuse('0048 : un prix negatif est refuse',
  $q$select public.fixer_tarif('produit', 7, -1)$q$, '100 000 000');
select pg_temp.refuse('0048 : une duree de tarif hors liste est refusee',
  $q$select public.fixer_tarif('produit', 5, 1000)$q$, 'Durée');
select public.fixer_tarif('produit', 7, 20000);
select pg_temp.refuse('0048 : un numero de paiement invalide est refuse',
  $q$select public.fixer_moyen_paiement('orange_money', '62a', 'Filloo', true)$q$, 'chiffres');
select pg_temp.refuse('0048 : un moyen de paiement inconnu est refuse',
  $q$select public.fixer_moyen_paiement('especes', '620000000', 'Filloo', true)$q$);
select public.fixer_moyen_paiement('orange_money', '+224 620 00-00.01', '  Filloo SARL ', true);
select public.fixer_moyen_paiement('mtn_momo', '664000001', 'Filloo SARL', false);
reset role;
select pg_temp.check('0048 : fixer un tarif le change, le signe et l''inscrit dans l''historique',
  (select prix_gnf = 20000 and modifie_par = 'a0420000-0000-0000-0000-000000000005' and modifie_at is not null
     from public.tarifs_publicite where type = 'produit' and duree_jours = 7)
  and exists (select 1 from public.journal_equipe j join public.tarifs_publicite t on t.id = j.cible_id
               where j.action = 'fixer_tarif' and j.cible_type = 'tarif' and j.auteur_nom = 'S'
                 and t.type = 'produit' and t.duree_jours = 7 and j.motif like '%15000 → 20000%'));
select pg_temp.check('0048 : fixer un numero le nettoie et l''inscrit dans l''historique',
  (select numero = '224620000001' and titulaire = 'Filloo SARL' and actif
     from public.moyens_paiement where moyen = 'orange_money')
  and (select count(*) from public.journal_equipe
        where action = 'fixer_moyen_paiement' and cible_type = 'moyen_paiement') = 2);

-- Une offre sans prix ne se demande pas (tarif retiré pour l'essai).
delete from public.tarifs_publicite where type = 'boutique' and duree_jours = 3;
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0048 : une offre sans prix ne se demande pas',
  $q$select public.demander_campagne('boutique', null, null, 3)$q$, 'pas encore de prix');

-- G demande : le prix est figé, la campagne est à payer.
insert into t48 select 'g_produit', public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f1', null, 7);
select pg_temp.refuse('0048 : le doublon compte une campagne a payer',
  $q$select public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f1', null, 30)$q$, 'déjà');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.fixer_tarif('produit', 7, 25000);
-- Le tarif retiré revient par fixer_tarif (insertion).
select public.fixer_tarif('boutique', 3, 10000);
select public.fixer_tarif('categorie', 3, 0);
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.check('0048 : une campagne payante nait a payer, au prix du jour, fige',
  (select statut = 'a_payer' and prix_gnf = 20000 and paiement_declare_at is null
     from public.campagnes where id = (select id from t48 where nom = 'g_produit')));
insert into t48 select 'g_gratuite', public.demander_campagne('categorie', 'a0470000-0000-0000-0000-0000000000f1', 1, 3);
select pg_temp.check('0048 : une offre a 0 GNF nait en attente',
  (select statut = 'en_attente' and prix_gnf = 0
     from public.campagnes where id = (select id from t48 where nom = 'g_gratuite')));
insert into t48 select 'g_boutique', public.demander_campagne('boutique', null, null, 7);
select pg_temp.refuse('0048 : le plafond de 3 compte les campagnes a payer',
  $q$select public.demander_campagne('produit', 'a0470000-0000-0000-0000-0000000000f2', null, 7)$q$, 'Trois');
reset role;

-- L'équipe ne valide pas avant la déclaration.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0048 : valider une campagne a payer est refuse',
  format('select public.decider_campagne(%L, true, null)', (select id from t48 where nom = 'g_produit')),
  'pas encore déclaré');

-- Déclarer : le propriétaire seulement, par un moyen actif.
select pg_temp.login('a0470000-0000-0000-0000-00000000000b');
select pg_temp.refuse('0048 : un commercant ne declare pas le paiement de la campagne d''un autre',
  format($q$select public.declarer_paiement(%L, 'orange_money', 'OM123456', '620112233')$q$,
         (select id from t48 where nom = 'g_produit')), 'introuvable');
select pg_temp.login('a0470000-0000-0000-0000-00000000000c');
select pg_temp.refuse('0048 : un client ne declare pas de paiement',
  format($q$select public.declarer_paiement(%L, 'orange_money', 'OM123456', '620112233')$q$,
         (select id from t48 where nom = 'g_produit')), 'boutiques en ligne');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0048 : l''equipe ne declare pas a la place du commercant',
  format($q$select public.declarer_paiement(%L, 'orange_money', 'OM123456', '620112233')$q$,
         (select id from t48 where nom = 'g_produit')));
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0048 : un moyen inactif est refuse',
  format($q$select public.declarer_paiement(%L, 'mtn_momo', 'MP123456', '620112233')$q$,
         (select id from t48 where nom = 'g_produit')), 'pas ouvert');
select pg_temp.refuse('0048 : le commercant ne declare pas des especes',
  format($q$select public.declarer_paiement(%L, 'especes', 'ES123456', '620112233')$q$,
         (select id from t48 where nom = 'g_produit')), 'Orange Money');
select pg_temp.refuse('0048 : une reference de moins de 3 caracteres est refusee',
  format($q$select public.declarer_paiement(%L, 'orange_money', ' ab ', '620112233')$q$,
         (select id from t48 where nom = 'g_produit')), 'référence');
select pg_temp.refuse('0048 : un numero payeur invalide est refuse',
  format($q$select public.declarer_paiement(%L, 'orange_money', 'OM123456', '6201')$q$,
         (select id from t48 where nom = 'g_produit')), 'chiffres');
select pg_temp.refuse('0048 : une campagne gratuite n''attend pas de paiement',
  format($q$select public.declarer_paiement(%L, 'orange_money', 'OM123456', '620112233')$q$,
         (select id from t48 where nom = 'g_gratuite')), 'n''attend pas');
select pg_temp.refuse('0048 : le commercant n''ecrit pas son paiement directement',
  $q$update public.campagnes set paiement_confirme_at = now()$q$);
select public.declarer_paiement((select id from t48 where nom = 'g_produit'), 'orange_money', 'OM123456', '620 11 22 33');
select public.declarer_paiement((select id from t48 where nom = 'g_produit'), 'orange_money', ' OM999999 ', '620112233');
select pg_temp.check('0048 : declarer passe en attente, et se corrige tant qu''on attend',
  (select statut = 'en_attente' and paiement_moyen = 'orange_money' and paiement_reference = 'OM999999'
          and paiement_numero = '620112233' and paiement_declare_at is not null and paiement_confirme_at is null
     from public.campagnes where id = (select id from t48 where nom = 'g_produit')));

-- L'équipe vérifie et valide ; refuse depuis « a_payer ».
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_campagne((select id from t48 where nom = 'g_produit'), true, null);
select public.decider_campagne((select id from t48 where nom = 'g_gratuite'), true, null);
select public.decider_campagne((select id from t48 where nom = 'g_boutique'), false, 'Pas de paiement recu');
reset role;
select pg_temp.check('0048 : valider une campagne payante confirme le paiement et l''historique le dit',
  (select statut = 'active' and paiement_confirme_par = 'a0420000-0000-0000-0000-000000000005'
          and paiement_confirme_at is not null
     from public.campagnes where id = (select id from t48 where nom = 'g_produit'))
  and exists (select 1 from public.journal_equipe
               where action = 'valider_campagne' and cible_id = (select id from t48 where nom = 'g_produit')
                 and motif like 'Paiement vérifié : 20000 GNF, orange_money OM999999'));
select pg_temp.check('0048 : valider une campagne gratuite ne confirme aucun paiement',
  (select statut = 'active' and paiement_confirme_at is null and paiement_confirme_par is null
     from public.campagnes where id = (select id from t48 where nom = 'g_gratuite')));
select pg_temp.check('0048 : une campagne a payer se refuse',
  (select statut = 'refusee' and motif = 'Pas de paiement recu'
     from public.campagnes where id = (select id from t48 where nom = 'g_boutique')));
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0048 : on ne declare plus une campagne validee',
  format($q$select public.declarer_paiement(%L, 'orange_money', 'OM000000', '620112233')$q$,
         (select id from t48 where nom = 'g_produit')), 'n''attend pas');
-- Annuler une campagne à payer.
insert into t48 select 'g_boutique_2', public.demander_campagne('boutique', null, null, 7);
select public.annuler_campagne((select id from t48 where nom = 'g_boutique_2'));
select pg_temp.check('0048 : une campagne a payer s''annule',
  (select statut from public.campagnes where id = (select id from t48 where nom = 'g_boutique_2')) = 'annulee');
-- G retient une place : boutique à payer (3 en cours avec les deux actives).
insert into t48 select 'g_boutique_3', public.demander_campagne('boutique', null, null, 7);

-- Rembourser : l'équipe, une fois, ce qui a été payé puis arrêté.
select pg_temp.refuse('0048 : un commercant ne se note pas rembourse',
  format('select public.marquer_rembourse(%L)', (select id from t48 where nom = 'g_produit')), 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0048 : une campagne en cours ne se rembourse pas',
  format('select public.marquer_rembourse(%L)', (select id from t48 where nom = 'g_produit')), 'refusée, annulée ou interrompue');
select pg_temp.refuse('0048 : une campagne jamais payee ne se rembourse pas',
  format('select public.marquer_rembourse(%L)', (select id from t48 where nom = 'g_boutique')), 'Rien n''a été payé');
select pg_temp.refuse('0048 : une campagne gratuite ne se rembourse pas',
  format('select public.marquer_rembourse(%L)', (select id from t48 where nom = 'g_gratuite')), 'Rien n''a été payé');
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select public.annuler_campagne((select id from t48 where nom = 'g_produit'));
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.marquer_rembourse((select id from t48 where nom = 'g_produit'));
select pg_temp.refuse('0048 : un remboursement ne se note qu''une fois',
  format('select public.marquer_rembourse(%L)', (select id from t48 where nom = 'g_produit')), 'déjà remboursée');
reset role;
select pg_temp.check('0048 : le remboursement est signe et dans l''historique',
  (select rembourse_par = 'a0420000-0000-0000-0000-000000000005' and rembourse_at is not null
     from public.campagnes where id = (select id from t48 where nom = 'g_produit'))
  and exists (select 1 from public.journal_equipe
               where action = 'rembourser_campagne' and cible_type = 'campagne'
                 and cible_id = (select id from t48 where nom = 'g_produit') and motif like '20000 GNF%'));

-- L'équipe crée une campagne payée ou offerte.
set role authenticated;
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0048 : un commercant ne cree pas de campagne d''equipe',
  $q$select public.creer_campagne_equipe('a0470000-0000-0000-0000-0000000000a1', 'boutique', null, null, 7, 'offert')$q$, 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0048 : creer sans moyen est refuse',
  $q$select public.creer_campagne_equipe('a0470000-0000-0000-0000-0000000000a1', 'produit', 'a0470000-0000-0000-0000-0000000000f2', null, 7)$q$, 'Moyen');
select pg_temp.refuse('0048 : creer avec un moyen inconnu est refuse',
  $q$select public.creer_campagne_equipe('a0470000-0000-0000-0000-0000000000a1', 'produit', 'a0470000-0000-0000-0000-0000000000f2', null, 7, 'carte')$q$, 'Moyen');
select pg_temp.refuse('0048 : l''equipe ne sponsorise pas un produit masque',
  $q$select public.creer_campagne_equipe('a0470000-0000-0000-0000-0000000000b1', 'produit', 'a0470000-0000-0000-0000-0000000000e1', null, 7, 'especes')$q$, 'pas publié');
select pg_temp.refuse('0048 : l''equipe ne vise pas le produit d''une autre boutique',
  $q$select public.creer_campagne_equipe('a0470000-0000-0000-0000-0000000000b1', 'produit', 'a0470000-0000-0000-0000-0000000000f2', null, 7, 'especes')$q$, 'pas publié');
select pg_temp.refuse('0048 : l''equipe respecte le doublon (boutique deja a payer)',
  $q$select public.creer_campagne_equipe('a0470000-0000-0000-0000-0000000000a1', 'boutique', null, null, 14, 'especes')$q$, 'déjà');
-- G a 2 campagnes en cours ou à payer : la 2e création de l'équipe est sa 4e (plafond ignoré).
insert into t48 select 'e_categorie', public.creer_campagne_equipe(
  'a0470000-0000-0000-0000-0000000000a1', 'categorie', 'a0470000-0000-0000-0000-0000000000f2', 2, 7, 'mtn_momo', ' MP777777 ');
insert into t48 select 'e_offerte', public.creer_campagne_equipe(
  p_merchant => 'a0470000-0000-0000-0000-0000000000a1', p_type => 'produit',
  p_product => 'a0470000-0000-0000-0000-0000000000f1', p_duree => 3, p_moyen => 'offert');
select pg_temp.refuse('0048 : une campagne d''equipe en cours ne se rembourse pas',
  format('select public.marquer_rembourse(%L)', (select id from t48 where nom = 'e_categorie')), 'refusée, annulée ou interrompue');
reset role;
select pg_temp.check('0048 : une campagne d''equipe est en cours, au tarif, payee et signee',
  (select statut = 'active' and prix_gnf = 10000 and fin_at - debut_at = interval '7 days'
          and paiement_moyen = 'mtn_momo' and paiement_reference = 'MP777777'
          and paiement_confirme_par = 'a0420000-0000-0000-0000-000000000005' and paiement_confirme_at is not null
          and creee_par_equipe = 'a0420000-0000-0000-0000-000000000005'
          and decidee_par = 'a0420000-0000-0000-0000-000000000005'
     from public.campagnes where id = (select id from t48 where nom = 'e_categorie')));
select pg_temp.check('0048 : une campagne offerte coute 0 et passe le plafond de 3',
  (select statut = 'active' and prix_gnf = 0 and paiement_moyen = 'offert'
     from public.campagnes where id = (select id from t48 where nom = 'e_offerte'))
  and (select count(*) from public.campagnes
        where merchant_id = 'a0470000-0000-0000-0000-0000000000a1'
          and (statut in ('a_payer', 'en_attente') or (statut = 'active' and fin_at > now()))) = 4);
select pg_temp.check('0048 : creer une campagne est dans l''historique',
  (select count(*) from public.journal_equipe
    where action = 'creer_campagne' and cible_type = 'campagne'
      and cible_id in (select id from t48 where nom like 'e_%')) = 2);
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0048 : une campagne d''equipe est montree dans sa categorie',
  exists (select 1 from public.produits_sponsorises(null, 2, 4)
           where campagne_id = (select id from t48 where nom = 'e_categorie')));
reset role;

-- L'interrompre la rend remboursable ; le remboursement daté du mois dernier.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.interrompre_campagne((select id from t48 where nom = 'e_categorie'), 'Produit en rupture');
select public.marquer_rembourse((select id from t48 where nom = 'e_categorie'));
reset role;
update public.campagnes set rembourse_at = now() - interval '40 days'
 where id = (select id from t48 where nom = 'e_categorie');

-- La file de l'équipe montre le paiement.
set role authenticated;
select pg_temp.check('0048 : la file de l''equipe montre prix, paiement et remboursement',
  exists (select 1 from public.campagnes_equipe() ce
           where ce.id = (select id from t48 where nom = 'g_produit')
             and ce.prix_gnf = 20000 and ce.paiement_moyen = 'orange_money'
             and ce.paiement_reference = 'OM999999' and ce.paiement_numero = '620112233'
             and ce.paiement_declare_at is not null and ce.paiement_confirme_at is not null
             and ce.rembourse_at is not null and ce.creee_par_equipe is null)
  and exists (select 1 from public.campagnes_equipe() ce
               where ce.id = (select id from t48 where nom = 'e_offerte')
                 and ce.creee_par_equipe = 'a0420000-0000-0000-0000-000000000005'));

-- Les revenus : encaissé au mois de la vérification, remboursé au mois du remboursement.
select pg_temp.check('0048 : les revenus du mois (offert exclu)',
  (select encaisse_gnf = 30000 and rembourse_gnf = 20000 and campagnes = 2
     from public.revenus_publicite()
    where mois = date_trunc('month', now() at time zone 'Africa/Conakry')::date));
select pg_temp.check('0048 : un remboursement compte au mois ou il a ete fait',
  (select encaisse_gnf = 0 and rembourse_gnf = 10000 and campagnes = 0
     from public.revenus_publicite()
    where mois = date_trunc('month', (now() - interval '40 days') at time zone 'Africa/Conakry')::date)
  and (select count(*) from public.revenus_publicite()) = 2);
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0048 : un commercant ne lit pas les revenus',
  'select * from public.revenus_publicite()', 'équipe');
select pg_temp.refuse('0048 : un commercant ne lit pas la file de l''equipe',
  'select * from public.campagnes_equipe()', 'équipe');
reset role;

-- =====================================================================
-- Une boutique peut s'abonner, Gratuit est limité à 10 produits (0049)
-- =====================================================================
-- P : commerçant « Chez P49 », produits p15 (le plus ancien), p01 … p14
-- (le plus récent), tous avec photo sauf p14 au départ. Q : commerçant
-- « Chez Q49 », produit q1 publié. R : client. S : équipe (0042).
-- Le moyen « orange_money » est actif et « mtn_momo » inactif (section 0048).
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0490000-0000-0000-0000-00000000000a', 'p0049@test.gn', '{"role":"merchant","full_name":"Marchand P","phone":"620004901"}'),
  ('a0490000-0000-0000-0000-00000000000b', 'q0049@test.gn', '{"role":"merchant","full_name":"Marchand Q","phone":"620004902"}'),
  ('a0490000-0000-0000-0000-00000000000c', 'r0049@test.gn', '{"role":"client","full_name":"Client R49","phone":"620004903"}');
update public.profiles set id = auth_user_id
 where auth_user_id in ('a0490000-0000-0000-0000-00000000000a', 'a0490000-0000-0000-0000-00000000000b',
                        'a0490000-0000-0000-0000-00000000000c');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-00000000000a', 'Chez P49', 1),
  ('a0490000-0000-0000-0000-0000000000b1', 'a0490000-0000-0000-0000-00000000000b', 'Chez Q49', 1);

create or replace function pg_temp.p49(n int) returns uuid
language sql immutable as $$ select ('a0490000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid $$;

insert into public.products (id, merchant_id, category_id, title, price_gnf, status, created_at)
select pg_temp.p49(n), 'a0490000-0000-0000-0000-0000000000a1', 1, 'Produit P' || lpad(n::text, 2, '0'),
       1000 * n, 'draft', now() - make_interval(days => 20 - n)
  from generate_series(1, 13) n;
insert into public.product_images (product_id, storage_path, position)
select pg_temp.p49(n), 'a0490000/p' || n || '/0.webp', 0 from generate_series(1, 13) n;
insert into public.products (id, merchant_id, category_id, title, price_gnf, status, created_at) values
  (pg_temp.p49(15), 'a0490000-0000-0000-0000-0000000000a1', 1, 'Produit P15', 15000, 'draft', now() - interval '25 days');
insert into public.product_images (product_id, storage_path, position) values (pg_temp.p49(15), 'a0490000/p15/0.webp', 0);
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0490000-0000-0000-0000-000000000201', 'a0490000-0000-0000-0000-0000000000b1', 1, 'Produit Q1', 5000, 'draft');
insert into public.product_images (product_id, storage_path, position) values
  ('a0490000-0000-0000-0000-000000000201', 'a0490000/q1/0.webp', 0);
update public.products set status = 'active' where id = 'a0490000-0000-0000-0000-000000000201';

create temp table t49 (nom text primary key, id uuid);
grant all on t49 to authenticated, anon;

-- Les tarifs d'origine reviennent (le truncate de tête les a vidés).
insert into public.tarifs_abonnement (formule, prix_gnf) select formule, prix_gnf from tarifs_abo_origine;
select pg_temp.check('0049 : deux tarifs pre-remplis, Pro 50 000 et Business 100 000',
  (select string_agg(formule || '=' || prix_gnf, ',' order by formule) from public.tarifs_abonnement)
    = 'business=100000,pro=50000'
  and (select count(distinct id) from public.tarifs_abonnement) = 2);

-- Les droits.
select pg_temp.check('0049 : les fonctions d''abonnement sont fermees a anon, ouvertes a authenticated',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.fixer_tarif_abonnement(text, int)', 'public.demander_abonnement(text)',
       'public.declarer_paiement_abonnement(uuid, text, text, text)', 'public.annuler_abonnement(uuid)',
       'public.decider_abonnement(uuid, boolean, text)', 'public.creer_abonnement_equipe(uuid, text, text, text)',
       'public.interrompre_abonnement(uuid, text)', 'public.marquer_abonnement_rembourse(uuid)',
       'public.ma_formule()', 'public.statistiques_boutique(int)', 'public.produits_les_plus_vus(int)',
       'public.tendances_filloo(int)', 'public.abonnements_equipe()', 'public.revenus_abonnements()']) as f));
select pg_temp.check('0049 : les fonctions internes ne s''appellent ni par anon ni par authenticated',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and not has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.formule_de(uuid)', 'public.restaurer_produits_masques(uuid)',
       'public.appliquer_limites_abonnement()', 'public.debut_prochaine_periode(uuid, text)',
       'public.produit_respecte_la_formule()']) as f));
select pg_temp.check('0049 : les badges sont ouverts a anon et authenticated',
  has_function_privilege('anon', 'public.badges_boutiques(uuid[])', 'execute')
  and has_function_privilege('authenticated', 'public.badges_boutiques(uuid[])', 'execute'));
select pg_temp.check('0049 : personne n''ecrit un abonnement ni un tarif directement',
  (select bool_and(not has_table_privilege(r, t, p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['public.abonnements', 'public.tarifs_abonnement']) t,
          unnest(array['insert', 'update', 'delete', 'truncate']) p)
  and not has_table_privilege('anon', 'public.abonnements', 'select')
  and has_table_privilege('anon', 'public.tarifs_abonnement', 'select')
  and not has_column_privilege('authenticated', 'public.products', 'masque_par_limite', 'update'));
select pg_temp.refuse('0049 : un abonnement a payer a un prix (contrainte)',
  $q$insert into public.abonnements (merchant_id, formule, statut, prix_gnf)
     values ('a0490000-0000-0000-0000-0000000000a1', 'pro', 'a_payer', 0)$q$);
select pg_temp.refuse('0049 : un abonnement offert est gratuit (contrainte)',
  $q$insert into public.abonnements (merchant_id, formule, prix_gnf, paiement_moyen)
     values ('a0490000-0000-0000-0000-0000000000a1', 'pro', 5000, 'offert')$q$);
select pg_temp.refuse('0049 : un abonnement actif a une periode (contrainte)',
  $q$insert into public.abonnements (merchant_id, formule, prix_gnf, statut)
     values ('a0490000-0000-0000-0000-0000000000a1', 'pro', 0, 'active')$q$);
select pg_temp.refuse('0049 : seul un produit masque porte masque_par_limite (contrainte)',
  $q$update public.products set masque_par_limite = true where id = 'a0490000-0000-0000-0000-000000000201'$q$);
select pg_temp.check('0049 : une boutique sans abonnement est en Gratuit',
  public.formule_de('a0490000-0000-0000-0000-0000000000a1') = 'gratuit');

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0049 : un visiteur lit les prix',
  (select count(*) from public.tarifs_abonnement) = 2);
select pg_temp.refuse('0049 : un visiteur ne lit pas les abonnements',
  'select 1 from public.abonnements');
select pg_temp.refuse('0049 : un visiteur ne lit pas la formule d''une boutique',
  $q$select public.formule_de('a0490000-0000-0000-0000-0000000000a1')$q$);
reset role;


-- La limite de la formule Gratuite (P, sans abonnement).
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : une publication groupee de 11 produits ne passe pas en Gratuit',
  $q$update public.products set status = 'active'
      where id in (select pg_temp.p49(n) from generate_series(1, 11) n)$q$, 'Formule Gratuite : 10 produits');
select pg_temp.check('0049 : la publication groupee refusee ne laisse rien publie',
  not exists (select 1 from public.products
               where merchant_id = 'a0490000-0000-0000-0000-0000000000a1' and status = 'active'));
update public.products set status = 'active' where id in (select pg_temp.p49(n) from generate_series(1, 10) n);
select pg_temp.check('0049 : 10 produits se publient en Gratuit',
  (select count(*) from public.products
    where merchant_id = 'a0490000-0000-0000-0000-0000000000a1' and status = 'active') = 10);
select pg_temp.refuse('0049 : le 11e produit est refuse en Gratuit, avec le message pour le commercant',
  format($q$update public.products set status = 'active' where id = %L$q$, pg_temp.p49(11)),
  'Formule Gratuite : 10 produits publiés au plus. Passez à Pro pour en publier davantage.');
update public.products set status = 'sold' where id = pg_temp.p49(10);
update public.products set status = 'active' where id = pg_temp.p49(11);
select pg_temp.check('0049 : un vendu libere une place',
  (select status from public.products where id = pg_temp.p49(11)) = 'active');
select pg_temp.refuse('0049 : remettre en vente au-dela de 10 est refuse',
  format($q$update public.products set status = 'active' where id = %L$q$, pg_temp.p49(10)), 'Formule Gratuite');
select pg_temp.refuse('0049 : le commercant n''ecrit pas masque_par_limite',
  format($q$update public.products set masque_par_limite = true where id = %L$q$, pg_temp.p49(11)));
insert into public.products (id, merchant_id, category_id, title, price_gnf, status, masque_par_limite)
values (pg_temp.p49(14), 'a0490000-0000-0000-0000-0000000000a1', 1, 'Produit P14', 14000, 'hidden', true);
select pg_temp.check('0049 : masque_par_limite ne s''ecrit pas a la creation',
  (select not masque_par_limite from public.products where id = pg_temp.p49(14)));
-- p12 masqué par l'équipe : c'est le message de 0046 qui parle, pas celui de la limite.
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.masquer_produit(pg_temp.p49(12), 'Photo trompeuse');
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : un produit masque par l''equipe garde le message de l''equipe',
  format($q$update public.products set status = 'active' where id = %L$q$, pg_temp.p49(12)), 'masqué par l''équipe');
reset role;
insert into public.product_images (product_id, storage_path, position) values (pg_temp.p49(14), 'a0490000/p14/0.webp', 0);
update public.products set created_at = now() - interval '1 hour' where id = pg_temp.p49(14);


-- Demander : une boutique en ligne, une formule connue, une demande à la fois.
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000c');
select pg_temp.refuse('0049 : un client ne demande pas d''abonnement',
  $q$select public.demander_abonnement('pro')$q$, 'boutiques en ligne');
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : une formule inconnue est refusee',
  $q$select public.demander_abonnement('gold')$q$, 'Formule inconnue');
select pg_temp.refuse('0049 : le commercant ne fixe pas un tarif',
  $q$select public.fixer_tarif_abonnement('pro', 1)$q$, 'équipe');
select pg_temp.refuse('0049 : le commercant n''ecrit pas un tarif directement',
  $q$update public.tarifs_abonnement set prix_gnf = 1$q$);
insert into t49 select 'p_pro', public.demander_abonnement('pro');
select pg_temp.refuse('0049 : une seule demande ouverte a la fois',
  $q$select public.demander_abonnement('business')$q$, 'déjà en cours');
select pg_temp.refuse('0049 : le commercant n''ecrit pas son abonnement directement',
  $q$update public.abonnements set statut = 'active'$q$);

-- L'équipe change le prix : la demande garde le sien.
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0049 : un prix de formule negatif est refuse',
  $q$select public.fixer_tarif_abonnement('pro', -1)$q$, '100 000 000');
select pg_temp.refuse('0049 : une formule de tarif inconnue est refusee',
  $q$select public.fixer_tarif_abonnement('gratuit', 0)$q$, 'Formule inconnue');
select public.fixer_tarif_abonnement('pro', 60000);
reset role;
select pg_temp.check('0049 : une demande payante nait a payer, au prix du jour, fige',
  (select statut = 'a_payer' and prix_gnf = 50000 and paiement_declare_at is null and debut_at is null
     from public.abonnements where id = (select id from t49 where nom = 'p_pro')));
select pg_temp.check('0049 : fixer un tarif d''abonnement le change, le signe et l''inscrit dans l''historique',
  (select prix_gnf = 60000 and modifie_par = 'a0420000-0000-0000-0000-000000000005'
     from public.tarifs_abonnement where formule = 'pro')
  and exists (select 1 from public.journal_equipe j join public.tarifs_abonnement t on t.id = j.cible_id
               where j.action = 'fixer_tarif_abonnement' and j.cible_type = 'tarif_abonnement'
                 and t.formule = 'pro' and j.motif = 'pro : 50000 → 60000 GNF'));
update public.tarifs_abonnement set prix_gnf = 50000 where formule = 'pro';

-- Déclarer : le propriétaire, un moyen actif.
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000b');
select pg_temp.refuse('0049 : un commercant ne declare pas le paiement de l''abonnement d''un autre',
  format($q$select public.declarer_paiement_abonnement(%L, 'orange_money', 'OM490001', '620112233')$q$,
         (select id from t49 where nom = 'p_pro')), 'introuvable');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0049 : l''equipe ne declare pas a la place du commercant',
  format($q$select public.declarer_paiement_abonnement(%L, 'orange_money', 'OM490001', '620112233')$q$,
         (select id from t49 where nom = 'p_pro')), 'boutiques en ligne');
select pg_temp.refuse('0049 : l''equipe ne valide pas un abonnement a payer',
  format('select public.decider_abonnement(%L, true)', (select id from t49 where nom = 'p_pro')),
  'pas encore déclaré');
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : un moyen inactif est refuse',
  format($q$select public.declarer_paiement_abonnement(%L, 'mtn_momo', 'MP490001', '620112233')$q$,
         (select id from t49 where nom = 'p_pro')), 'pas ouvert');
select pg_temp.refuse('0049 : le commercant ne declare pas des especes',
  format($q$select public.declarer_paiement_abonnement(%L, 'especes', 'ES490001', '620112233')$q$,
         (select id from t49 where nom = 'p_pro')), 'Orange Money');
select pg_temp.refuse('0049 : une reference trop courte est refusee',
  format($q$select public.declarer_paiement_abonnement(%L, 'orange_money', 'ab', '620112233')$q$,
         (select id from t49 where nom = 'p_pro')), 'référence');
select pg_temp.refuse('0049 : un numero payeur invalide est refuse',
  format($q$select public.declarer_paiement_abonnement(%L, 'orange_money', 'OM490001', '62')$q$,
         (select id from t49 where nom = 'p_pro')), 'chiffres');
select public.declarer_paiement_abonnement((select id from t49 where nom = 'p_pro'), 'orange_money', ' OM490001 ', '620 11-22.33');
select pg_temp.check('0049 : declarer passe en attente, nettoye',
  (select statut = 'en_attente' and paiement_moyen = 'orange_money' and paiement_reference = 'OM490001'
          and paiement_numero = '620112233' and paiement_declare_at is not null
     from public.abonnements where id = (select id from t49 where nom = 'p_pro')));

-- Valider : seulement l'équipe ; la période commence maintenant, un mois.
select pg_temp.refuse('0049 : un commercant ne valide pas son abonnement',
  format('select public.decider_abonnement(%L, true)', (select id from t49 where nom = 'p_pro')), 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_abonnement((select id from t49 where nom = 'p_pro'), true);
select pg_temp.refuse('0049 : un abonnement ne se decide qu''une fois',
  format('select public.decider_abonnement(%L, false, %L)', (select id from t49 where nom = 'p_pro'), 'Trop tard'),
  'déjà été décidé');
reset role;
select pg_temp.check('0049 : valider ouvre un mois tout de suite et confirme le paiement',
  (select statut = 'active' and debut_at <= now() and debut_at > now() - interval '1 minute'
          and fin_at = debut_at + interval '1 month'
          and paiement_confirme_par = 'a0420000-0000-0000-0000-000000000005' and paiement_confirme_at is not null
          and decidee_par = 'a0420000-0000-0000-0000-000000000005'
     from public.abonnements where id = (select id from t49 where nom = 'p_pro'))
  and exists (select 1 from public.journal_equipe
               where action = 'valider_abonnement' and cible_type = 'abonnement'
                 and cible_id = (select id from t49 where nom = 'p_pro')
                 and motif = 'Paiement vérifié : 50000 GNF, orange_money OM490001'));
select pg_temp.check('0049 : la boutique est en Pro',
  public.formule_de('a0490000-0000-0000-0000-0000000000a1') = 'pro');

set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.check('0049 : ma_formule dit Pro, sa fin, pas de grace, pas de limite',
  (select f.formule = 'pro' and not f.en_grace and f.limite_produits is null
          and f.fin_at = (select fin_at from public.abonnements where id = (select id from t49 where nom = 'p_pro'))
     from public.ma_formule() f));
update public.products set status = 'active' where id in (pg_temp.p49(10), pg_temp.p49(13), pg_temp.p49(14), pg_temp.p49(15));
select pg_temp.check('0049 : en Pro, plus de 10 produits se publient',
  (select count(*) from public.products
    where merchant_id = 'a0490000-0000-0000-0000-0000000000a1' and status = 'active') = 14);
select pg_temp.check('0049 : la boutique lit ses abonnements',
  (select count(*) from public.abonnements) = 1);

-- Renouveler avant la fin : la période suit la précédente.
insert into t49 select 'p_pro_2', public.demander_abonnement('pro');
select public.declarer_paiement_abonnement((select id from t49 where nom = 'p_pro_2'), 'orange_money', 'OM490002', '620112233');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_abonnement((select id from t49 where nom = 'p_pro_2'), true);
reset role;
select pg_temp.check('0049 : un renouvellement anticipe commence a la fin du precedent',
  (select b.debut_at = a.fin_at and b.fin_at = a.fin_at + interval '1 month'
     from public.abonnements a, public.abonnements b
    where a.id = (select id from t49 where nom = 'p_pro') and b.id = (select id from t49 where nom = 'p_pro_2')));
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.check('0049 : ma_formule donne la fin la plus lointaine',
  (select f.fin_at = (select fin_at from public.abonnements where id = (select id from t49 where nom = 'p_pro_2'))
     from public.ma_formule() f));

-- L'équipe crée Business payé en espèces : il commence tout de suite.
select pg_temp.refuse('0049 : un commercant ne cree pas d''abonnement d''equipe',
  $q$select public.creer_abonnement_equipe('a0490000-0000-0000-0000-0000000000a1', 'business', 'offert')$q$, 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0049 : creer sans moyen est refuse',
  $q$select public.creer_abonnement_equipe('a0490000-0000-0000-0000-0000000000a1', 'business')$q$, 'Moyen');
select pg_temp.refuse('0049 : creer avec un moyen inconnu est refuse',
  $q$select public.creer_abonnement_equipe('a0490000-0000-0000-0000-0000000000a1', 'business', 'carte')$q$, 'Moyen');
select pg_temp.refuse('0049 : creer pour une boutique inconnue est refuse',
  $q$select public.creer_abonnement_equipe('a0490000-0000-0000-0000-0000000000ff', 'business', 'especes')$q$, 'pas en ligne');
insert into t49 select 'p_business', public.creer_abonnement_equipe(
  'a0490000-0000-0000-0000-0000000000a1', 'business', 'especes', ' ES-4901 ');
insert into t49 select 'q_offert', public.creer_abonnement_equipe(
  p_merchant => 'a0490000-0000-0000-0000-0000000000b1', p_formule => 'pro', p_moyen => 'offert');
reset role;
select pg_temp.check('0049 : Business cree par l''equipe commence maintenant, au tarif, paye et signe',
  (select statut = 'active' and prix_gnf = 100000 and debut_at > now() - interval '1 minute'
          and fin_at = debut_at + interval '1 month'
          and paiement_moyen = 'especes' and paiement_reference = 'ES-4901'
          and paiement_confirme_par = 'a0420000-0000-0000-0000-000000000005'
          and creee_par_equipe = 'a0420000-0000-0000-0000-000000000005'
     from public.abonnements where id = (select id from t49 where nom = 'p_business')));
select pg_temp.check('0049 : la formule effective est la plus haute',
  public.formule_de('a0490000-0000-0000-0000-0000000000a1') = 'business');
select pg_temp.check('0049 : un abonnement offert coute 0',
  (select statut = 'active' and prix_gnf = 0 and paiement_moyen = 'offert'
     from public.abonnements where id = (select id from t49 where nom = 'q_offert')));
select pg_temp.check('0049 : creer un abonnement est dans l''historique',
  (select count(*) from public.journal_equipe
    where action = 'creer_abonnement' and cible_type = 'abonnement'
      and cible_id in (select id from t49 where nom in ('p_business', 'q_offert'))) = 2);

-- Les badges : boutiques en ligne, période payée, la plus haute formule.
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0049 : un visiteur voit les badges Business et Pro, pas Gratuit',
  (select string_agg(b.merchant_id::text || '=' || b.formule, ',' order by b.merchant_id)
     from public.badges_boutiques(array['a0490000-0000-0000-0000-0000000000a1',
                                        'a0490000-0000-0000-0000-0000000000b1',
                                        'a0470000-0000-0000-0000-0000000000a1']::uuid[]) b)
    = 'a0490000-0000-0000-0000-0000000000a1=business,a0490000-0000-0000-0000-0000000000b1=pro');
select pg_temp.check('0049 : badges d''une liste vide ou nulle : rien',
  not exists (select 1 from public.badges_boutiques(null))
  and not exists (select 1 from public.badges_boutiques('{}'::uuid[])));
reset role;
update public.profiles set is_suspended = true where id = 'a0490000-0000-0000-0000-00000000000b';
set role anon;
select pg_temp.check('0049 : une boutique suspendue n''a pas de badge',
  not exists (select 1 from public.badges_boutiques(array['a0490000-0000-0000-0000-0000000000b1']::uuid[])));
reset role;
update public.profiles set is_suspended = false where id = 'a0490000-0000-0000-0000-00000000000b';

-- Q : demander, ne pas payer, annuler ; redemander, se faire refuser.
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000b');
insert into t49 select 'q_business', public.demander_abonnement('business');
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : on n''annule pas l''abonnement d''un autre',
  format('select public.annuler_abonnement(%L)', (select id from t49 where nom = 'q_business')), 'introuvable');
select pg_temp.refuse('0049 : un abonnement en cours ne s''annule pas',
  format('select public.annuler_abonnement(%L)', (select id from t49 where nom = 'p_pro')), 'ne peut plus');
select pg_temp.login('a0490000-0000-0000-0000-00000000000b');
select pg_temp.check('0049 : une boutique ne lit que ses abonnements',
  (select count(*) from public.abonnements) = 2
  and not exists (select 1 from public.abonnements where merchant_id = 'a0490000-0000-0000-0000-0000000000a1'));
select public.annuler_abonnement((select id from t49 where nom = 'q_business'));
insert into t49 select 'q_business_2', public.demander_abonnement('business');
select public.declarer_paiement_abonnement((select id from t49 where nom = 'q_business_2'), 'orange_money', 'OM490003', '620445566');
select pg_temp.login('a0490000-0000-0000-0000-00000000000c');
select pg_temp.check('0049 : un client ne lit aucun abonnement',
  not exists (select 1 from public.abonnements));
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0049 : refuser exige un motif',
  format('select public.decider_abonnement(%L, false)', (select id from t49 where nom = 'q_business_2')), 'motif');
select public.decider_abonnement((select id from t49 where nom = 'q_business_2'), false, 'Reference introuvable');
reset role;
select pg_temp.check('0049 : annuler et refuser',
  (select statut from public.abonnements where id = (select id from t49 where nom = 'q_business')) = 'annulee'
  and (select statut = 'refusee' and motif = 'Reference introuvable'
         from public.abonnements where id = (select id from t49 where nom = 'q_business_2'))
  and exists (select 1 from public.journal_equipe
               where action = 'refuser_abonnement' and cible_id = (select id from t49 where nom = 'q_business_2')));

-- Interrompre Business : P retombe en Pro, sans grâce.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0049 : interrompre exige un motif',
  format('select public.interrompre_abonnement(%L, %L)', (select id from t49 where nom = 'p_business'), ' '), 'motif');
select public.interrompre_abonnement((select id from t49 where nom = 'p_business'), 'Paiement en especes contrefait');
select pg_temp.refuse('0049 : on n''interrompt pas deux fois',
  format('select public.interrompre_abonnement(%L, %L)', (select id from t49 where nom = 'p_business'), 'Encore'), 'en cours');
reset role;
select pg_temp.check('0049 : un abonnement interrompu s''arrete tout de suite, sans grace',
  (select statut = 'interrompue' and fin_at <= now() and fin_at > now() - interval '1 minute'
     from public.abonnements where id = (select id from t49 where nom = 'p_business'))
  and public.formule_de('a0490000-0000-0000-0000-0000000000a1') = 'pro'
  and exists (select 1 from public.journal_equipe
               where action = 'interrompre_abonnement' and cible_id = (select id from t49 where nom = 'p_business')));

-- Rembourser : payé puis arrêté, une fois.
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : un commercant ne se note pas rembourse',
  format('select public.marquer_abonnement_rembourse(%L)', (select id from t49 where nom = 'p_business')), 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0049 : un abonnement en cours ne se rembourse pas',
  format('select public.marquer_abonnement_rembourse(%L)', (select id from t49 where nom = 'p_pro')), 'refusé, annulé ou interrompu');
select pg_temp.refuse('0049 : un abonnement offert ne se rembourse pas',
  format('select public.marquer_abonnement_rembourse(%L)', (select id from t49 where nom = 'q_offert')), 'Rien n''a été payé');
select pg_temp.refuse('0049 : un abonnement annule jamais paye ne se rembourse pas',
  format('select public.marquer_abonnement_rembourse(%L)', (select id from t49 where nom = 'q_business')), 'Rien n''a été payé');
select public.marquer_abonnement_rembourse((select id from t49 where nom = 'p_business'));
select pg_temp.refuse('0049 : un remboursement ne se note qu''une fois',
  format('select public.marquer_abonnement_rembourse(%L)', (select id from t49 where nom = 'p_business')), 'déjà remboursé');
reset role;
select pg_temp.check('0049 : le remboursement est signe et dans l''historique',
  (select rembourse_par = 'a0420000-0000-0000-0000-000000000005' and rembourse_at is not null
     from public.abonnements where id = (select id from t49 where nom = 'p_business'))
  and exists (select 1 from public.journal_equipe
               where action = 'rembourser_abonnement' and cible_type = 'abonnement'
                 and cible_id = (select id from t49 where nom = 'p_business') and motif = '100000 GNF, especes ES-4901'));

-- La file et les revenus de l'équipe.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0049 : la file de l''equipe montre boutique, formule et paiement',
  exists (select 1 from public.abonnements_equipe() ae
           where ae.id = (select id from t49 where nom = 'p_pro') and ae.shop_name = 'Chez P49'
             and ae.merchant_id = 'a0490000-0000-0000-0000-0000000000a1' and ae.formule = 'pro'
             and ae.prix_gnf = 50000 and ae.paiement_moyen = 'orange_money' and ae.paiement_reference = 'OM490001'
             and ae.paiement_numero = '620112233' and ae.paiement_declare_at is not null
             and ae.paiement_confirme_at is not null and ae.rembourse_at is null and ae.creee_par_equipe is null)
  and exists (select 1 from public.abonnements_equipe() ae
               where ae.id = (select id from t49 where nom = 'p_business')
                 and ae.rembourse_at is not null and ae.creee_par_equipe is not null)
  and (select count(*) from public.abonnements_equipe()) = 6);
select pg_temp.check('0049 : les revenus du mois (offert exclu, remboursement compte)',
  (select encaisse_gnf = 200000 and rembourse_gnf = 100000 and abonnements = 3
     from public.revenus_abonnements()
    where mois = date_trunc('month', now() at time zone 'Africa/Conakry')::date)
  and (select count(*) from public.revenus_abonnements()) = 1);
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : un commercant ne lit pas les revenus d''abonnement',
  'select * from public.revenus_abonnements()', 'équipe');
select pg_temp.refuse('0049 : un commercant ne lit pas la file des abonnements',
  'select * from public.abonnements_equipe()', 'équipe');
reset role;


-- Les statistiques (P en Pro, Q en Pro offert).
insert into public.analytics_events (name, occurred_at, merchant_id, product_id) values
  ('boutique_vue',    now(),                       'a0490000-0000-0000-0000-0000000000a1', null),
  ('boutique_vue',    now(),                       'a0490000-0000-0000-0000-0000000000a1', null),
  ('produit_vu',      now() - interval '1 day',    'a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-000000000101'),
  ('produit_vu',      now() - interval '1 day',    'a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-000000000101'),
  ('produit_vu',      now() - interval '1 day',    'a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-000000000101'),
  ('produit_vu',      now() - interval '2 days',   'a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-000000000102'),
  ('contact_ouvert',  now() - interval '1 day',    'a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-000000000101'),
  ('whatsapp_ouvert', now(),                       'a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-000000000102'),
  ('produit_vu',      now() - interval '40 days',  'a0490000-0000-0000-0000-0000000000a1', 'a0490000-0000-0000-0000-000000000103'),
  ('produit_vu',      now(),                       'a0490000-0000-0000-0000-0000000000b1', 'a0490000-0000-0000-0000-000000000201'),
  ('boutique_vue',    now(),                       'a0490000-0000-0000-0000-0000000000b1', null);
insert into public.analytics_events (name, search_query, result_count, category_id)
select 'recherche', q, rc, cat from (values
  ('  Riz   LOCAL ', 4, null::int), ('riz local', 4, null), ('Riz Local', 4, 1),
  ('telephone', 0, null), ('telephone', 0, null),
  ('pagne bazin', 0, null), ('pagne bazin', 0, null), ('pagne bazin', 0, null),
  (null, 3, 2), (null, 3, 2), (null, 3, 2)) v(q, rc, cat);

set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : une periode de moins de 7 jours est refusee',
  'select * from public.statistiques_boutique(6)', '7 à 90');
select pg_temp.refuse('0049 : une periode de plus de 90 jours est refusee',
  'select * from public.produits_les_plus_vus(91)', '7 à 90');
select pg_temp.check('0049 : statistiques : tous les jours de la periode, meme a zero',
  (select count(*) = 7 and min(jour) = (now() at time zone 'Africa/Conakry')::date - 6
          and max(jour) = (now() at time zone 'Africa/Conakry')::date
          and sum(boutique_vues) = 2 and sum(produits_vus) = 4 and sum(contacts) = 1 and sum(whatsapp) = 1
     from public.statistiques_boutique(7)));
select pg_temp.check('0049 : statistiques : chaque mesure tombe sur son jour',
  (select produits_vus = 3 and contacts = 1 and boutique_vues = 0
     from public.statistiques_boutique(7) where jour = (now() at time zone 'Africa/Conakry')::date - 1));
select pg_temp.check('0049 : statistiques par defaut : 30 jours, sans la mesure de 40 jours',
  (select count(*) = 30 and sum(produits_vus) = 4 from public.statistiques_boutique()));
select pg_temp.check('0049 : les produits les plus vus de la boutique, et seulement les siens',
  (select string_agg(titre || ':' || vues || '/' || contacts, ',' order by vues desc)
     from public.produits_les_plus_vus(30)) = 'Produit P01:3/1,Produit P02:1/0');
select pg_temp.refuse('0049 : les tendances sont reservees a Business',
  'select * from public.tendances_filloo(30)', 'formule Business');
select pg_temp.login('a0490000-0000-0000-0000-00000000000b');
select pg_temp.check('0049 : Q ne voit que ses propres statistiques',
  (select sum(produits_vus) = 1 and sum(boutique_vues) = 1 from public.statistiques_boutique(7)));
select pg_temp.login('a0470000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0049 : une boutique Gratuite ne lit pas de statistiques',
  'select * from public.statistiques_boutique(30)', 'Réservé aux formules Pro et Business.');
select pg_temp.refuse('0049 : une boutique Gratuite ne lit pas ses produits les plus vus',
  'select * from public.produits_les_plus_vus(30)', 'Réservé aux formules Pro et Business.');
select pg_temp.login('a0490000-0000-0000-0000-00000000000c');
select pg_temp.refuse('0049 : un client ne lit pas de statistiques',
  'select * from public.statistiques_boutique(30)', 'Réservé aux formules Pro et Business.');
-- Q passe en Business (offert) pour lire les tendances.
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.creer_abonnement_equipe('a0490000-0000-0000-0000-0000000000b1', 'business', 'offert');
select pg_temp.login('a0490000-0000-0000-0000-00000000000b');
select pg_temp.check('0049 : tendances : recherches normalisees, seuil de 3, categories nommees',
  (select string_agg(genre || '|' || libelle || '|' || total, ',' order by genre, total desc, libelle)
     from public.tendances_filloo(30))
    = 'categorie|' || (select name from public.categories where id = 2) || '|3,'
      'recherche|pagne bazin|3,recherche|riz local|3,recherche_sans_resultat|pagne bazin|3');
reset role;


-- La grâce, puis le retour en Gratuit (P). Sa période Pro est reculée.
update public.abonnements
   set debut_at = now() - interval '2 months' - interval '3 days',
       fin_at   = now() - interval '1 month' - interval '3 days'
 where id = (select id from t49 where nom = 'p_pro');
update public.abonnements
   set debut_at = now() - interval '1 month' - interval '3 days',
       fin_at   = now() - interval '3 days'
 where id = (select id from t49 where nom = 'p_pro_2');
select public.appliquer_limites_abonnement();
select pg_temp.check('0049 : pendant la grace, la formule reste Pro et rien n''est masque',
  public.formule_de('a0490000-0000-0000-0000-0000000000a1') = 'pro'
  and (select count(*) from public.products
        where merchant_id = 'a0490000-0000-0000-0000-0000000000a1' and status = 'active') = 14);
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.check('0049 : ma_formule dit la grace',
  (select f.formule = 'pro' and f.en_grace and f.fin_at < now() and f.limite_produits is null
     from public.ma_formule() f));
select pg_temp.check('0049 : les statistiques restent ouvertes pendant la grace',
  (select count(*) = 7 from public.statistiques_boutique(7)));
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0049 : pas de badge pendant la grace',
  not exists (select 1 from public.badges_boutiques(array['a0490000-0000-0000-0000-0000000000a1']::uuid[])));
reset role;

update public.abonnements set debut_at = debut_at - interval '5 days', fin_at = fin_at - interval '5 days'
 where id in (select id from t49 where nom in ('p_pro', 'p_pro_2'));
select pg_temp.check('0049 : apres 7 jours de grace, la boutique est en Gratuit',
  public.formule_de('a0490000-0000-0000-0000-0000000000a1') = 'gratuit');
select public.appliquer_limites_abonnement();
select pg_temp.check('0049 : la passe de la nuit garde les 10 plus recents et masque les plus anciens',
  (select count(*) from public.products
    where merchant_id = 'a0490000-0000-0000-0000-0000000000a1' and status = 'active') = 10
  and (select string_agg(title, ',' order by title) from public.products
        where merchant_id = 'a0490000-0000-0000-0000-0000000000a1' and masque_par_limite and status = 'hidden')
      = 'Produit P01,Produit P02,Produit P03,Produit P15'
  and exists (select 1 from public.products where id = pg_temp.p49(12) and status = 'hidden'
                                               and masque_par_equipe and not masque_par_limite)
  and (select count(*) from public.products where id = 'a0490000-0000-0000-0000-000000000201' and status = 'active') = 1);
select public.appliquer_limites_abonnement();
select pg_temp.check('0049 : la passe de la nuit se rejoue sans rien changer',
  (select count(*) from public.products where masque_par_limite) = 4);

set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
select pg_temp.check('0049 : ma_formule dit Gratuit et la limite',
  (select f.formule = 'gratuit' and f.limite_produits = 10 and not f.en_grace and f.fin_at is null
     from public.ma_formule() f));
select pg_temp.refuse('0049 : en Gratuit, un produit masque par la limite ne se republie pas a 10',
  format($q$update public.products set status = 'active' where id = %L$q$, pg_temp.p49(1)), 'Formule Gratuite');
update public.products set status = 'hidden' where id = pg_temp.p49(4);
update public.products set status = 'active' where id = pg_temp.p49(2);
select pg_temp.check('0049 : republier un produit masque par la limite efface le drapeau',
  (select status = 'active' and not masque_par_limite from public.products where id = pg_temp.p49(2)));
select pg_temp.refuse('0049 : les statistiques se ferment en Gratuit',
  'select * from public.statistiques_boutique(7)', 'Réservé aux formules Pro et Business.');
reset role;

-- Le retour : un abonnement activé republie les produits masqués par la
-- limite (p15), pas ceux que l'équipe a masqués ensuite (p03), pas ceux du
-- commerçant (p04), pas un sans photo (p01).
delete from public.product_images where product_id = pg_temp.p49(1);
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.masquer_produit(pg_temp.p49(3), 'Contrefacon signalee');
reset role;
select pg_temp.check('0049 : masquer par l''equipe un produit masque par la limite garde les deux drapeaux',
  (select status = 'hidden' and masque_par_equipe and masque_par_limite from public.products where id = pg_temp.p49(3)));
set role authenticated;
select pg_temp.login('a0490000-0000-0000-0000-00000000000a');
insert into t49 select 'p_pro_3', public.demander_abonnement('pro');
select public.declarer_paiement_abonnement((select id from t49 where nom = 'p_pro_3'), 'orange_money', 'OM490004', '620112233');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_abonnement((select id from t49 where nom = 'p_pro_3'), true);
reset role;
select pg_temp.check('0049 : apres expiration, le nouvel abonnement commence maintenant',
  (select debut_at > now() - interval '1 minute' from public.abonnements where id = (select id from t49 where nom = 'p_pro_3')));
select pg_temp.check('0049 : a l''activation, les produits masques par la limite reviennent',
  (select status = 'active' and not masque_par_limite from public.products where id = pg_temp.p49(15)));
select pg_temp.check('0049 : un produit masque par l''equipe ne revient pas',
  (select status = 'hidden' and masque_par_equipe from public.products where id = pg_temp.p49(3))
  and (select status = 'hidden' and masque_par_equipe from public.products where id = pg_temp.p49(12)));
select pg_temp.check('0049 : un produit que le commercant a masque ne revient pas',
  (select status = 'hidden' and not masque_par_limite from public.products where id = pg_temp.p49(4)));
select pg_temp.check('0049 : un produit masque sans photo ne revient pas (et ne bloque pas l''activation)',
  (select status = 'hidden' and masque_par_limite from public.products where id = pg_temp.p49(1)));

-- Les campagnes en cours sont maintenues (décision du 2026-11-07) : G,
-- revenue en Gratuit avec 12 produits publiés, g01 (le plus ancien) …
-- g12. g01 porte une campagne active, g02 une campagne payée en attente
-- de validation, g03 une demande « a_payer », g04 une campagne terminée.
-- Attendu : g01 et g02 gardés, g03 et g04 masqués (les deux plus anciens
-- sans campagne en cours).
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0491000-0000-0000-0000-00000000000a', 'g0049@test.gn', '{"role":"merchant","full_name":"Marchand G","phone":"620004904"}');
update public.profiles set id = auth_user_id where auth_user_id = 'a0491000-0000-0000-0000-00000000000a';
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0491000-0000-0000-0000-0000000000a1', 'a0491000-0000-0000-0000-00000000000a', 'Chez G49', 1);
create or replace function pg_temp.g49(n int) returns uuid
language sql immutable as $$ select ('a0491000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid $$;
insert into public.products (id, merchant_id, category_id, title, price_gnf, status, created_at)
select pg_temp.g49(n), 'a0491000-0000-0000-0000-0000000000a1', 1, 'Produit G' || lpad(n::text, 2, '0'),
       1000 * n, 'draft', now() - make_interval(days => 30 - n)
  from generate_series(1, 12) n;
insert into public.product_images (product_id, storage_path, position)
select pg_temp.g49(n), 'a0491000/g' || n || '/0.webp', 0 from generate_series(1, 12) n;
-- Publiés pendant un Pro offert, que l'on recule ensuite au-delà de la grâce.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.creer_abonnement_equipe('a0491000-0000-0000-0000-0000000000a1', 'pro', 'offert');
reset role;
update public.products set status = 'active' where merchant_id = 'a0491000-0000-0000-0000-0000000000a1';
update public.abonnements
   set debut_at = now() - interval '2 months', fin_at = now() - interval '1 month'
 where merchant_id = 'a0491000-0000-0000-0000-0000000000a1';
insert into public.campagnes (merchant_id, type, product_id, duree_jours, prix_gnf, statut, debut_at, fin_at) values
  ('a0491000-0000-0000-0000-0000000000a1', 'produit', pg_temp.g49(1), 7, 0, 'active', now() - interval '1 day', now() + interval '6 days'),
  ('a0491000-0000-0000-0000-0000000000a1', 'produit', pg_temp.g49(2), 7, 25000, 'en_attente', null, null),
  ('a0491000-0000-0000-0000-0000000000a1', 'produit', pg_temp.g49(3), 7, 25000, 'a_payer', null, null),
  ('a0491000-0000-0000-0000-0000000000a1', 'produit', pg_temp.g49(4), 7, 0, 'active', now() - interval '8 days', now() - interval '1 day');
select pg_temp.check('0049 : G est en Gratuit avec 12 produits publies',
  public.formule_de('a0491000-0000-0000-0000-0000000000a1') = 'gratuit'
  and (select count(*) from public.products
        where merchant_id = 'a0491000-0000-0000-0000-0000000000a1' and status = 'active') = 12);
select public.appliquer_limites_abonnement();
select pg_temp.check('0049 : la nuit garde le produit d''une campagne active, meme le plus ancien',
  (select status = 'active' and not masque_par_limite from public.products where id = pg_temp.g49(1)));
select pg_temp.check('0049 : la nuit garde le produit d''une campagne payee en attente de validation',
  (select status = 'active' and not masque_par_limite from public.products where id = pg_temp.g49(2)));
select pg_temp.check('0049 : une demande a_payer ne protege pas son produit',
  (select status = 'hidden' and masque_par_limite from public.products where id = pg_temp.g49(3)));
select pg_temp.check('0049 : une campagne terminee ne protege pas son produit',
  (select status = 'hidden' and masque_par_limite from public.products where id = pg_temp.g49(4)));
select pg_temp.check('0049 : avec des campagnes, G garde exactement 10 produits, les autres sont les plus recents',
  (select count(*) from public.products
    where merchant_id = 'a0491000-0000-0000-0000-0000000000a1' and status = 'active') = 10
  and (select string_agg(title, ',' order by title) from public.products
        where merchant_id = 'a0491000-0000-0000-0000-0000000000a1' and status = 'hidden')
      = 'Produit G03,Produit G04');
-- Les campagnes de G ne doivent pas peser sur les sections suivantes.
delete from public.campagnes where merchant_id = 'a0491000-0000-0000-0000-0000000000a1';




-- =====================================================================
-- Une boutique achète des crédits et paie sa publicité avec (0050)
-- =====================================================================
-- U : commerçant « Chez U50 », produits u1 … u4 publiés (cat. 1).
-- V : commerçant « Chez V50 », produit v1 publié. W : client. S : équipe.
-- Moyens : « orange_money » actif, « mtn_momo » inactif (section 0048).
-- Tarifs de publicité d'origine (section 0048) : produit 3 j = 7 000,
-- produit 7 j = 15 000, boutique 30 j = 60 000.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0500000-0000-0000-0000-00000000000a', 'u0050@test.gn', '{"role":"merchant","full_name":"Marchand U","phone":"620005001"}'),
  ('a0500000-0000-0000-0000-00000000000b', 'v0050@test.gn', '{"role":"merchant","full_name":"Marchand V","phone":"620005002"}'),
  ('a0500000-0000-0000-0000-00000000000c', 'w0050@test.gn', '{"role":"client","full_name":"Client W50","phone":"620005003"}');
update public.profiles set id = auth_user_id
 where auth_user_id in ('a0500000-0000-0000-0000-00000000000a', 'a0500000-0000-0000-0000-00000000000b',
                        'a0500000-0000-0000-0000-00000000000c');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0500000-0000-0000-0000-0000000000a1', 'a0500000-0000-0000-0000-00000000000a', 'Chez U50', 1),
  ('a0500000-0000-0000-0000-0000000000b1', 'a0500000-0000-0000-0000-00000000000b', 'Chez V50', 1);

create or replace function pg_temp.u50(n int) returns uuid
language sql immutable as $$ select ('a0500000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid $$;

insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
select pg_temp.u50(n), 'a0500000-0000-0000-0000-0000000000a1', 1, 'Produit U' || n, 1000 * n, 'draft'
  from generate_series(1, 4) n;
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0500000-0000-0000-0000-000000000201', 'a0500000-0000-0000-0000-0000000000b1', 1, 'Produit V1', 5000, 'draft');
insert into public.product_images (product_id, storage_path, position)
select pg_temp.u50(n), 'a0500000/u' || n || '/0.webp', 0 from generate_series(1, 4) n;
insert into public.product_images (product_id, storage_path, position) values
  ('a0500000-0000-0000-0000-000000000201', 'a0500000/v1/0.webp', 0);
update public.products set status = 'active' where merchant_id in ('a0500000-0000-0000-0000-0000000000a1',
                                                                    'a0500000-0000-0000-0000-0000000000b1');

create temp table t50 (nom text primary key, id uuid, n bigint);
grant all on t50 to authenticated, anon;

-- Le solde de U, lu comme le site le lit.
create or replace function pg_temp.solde_u() returns int
language sql as $$
  select coalesce((select disponibles from public.mes_credits()), -1)
$$;
create or replace function pg_temp.lot(p_nom text) returns public.lots_credits
language sql as $$ select l.* from public.lots_credits l where l.id = (select id from t50 where nom = p_nom) $$;

-- Les tarifs de publicité d'origine reviennent (la section 0048 en a changé).
update public.tarifs_publicite t set prix_gnf = o.prix_gnf
  from tarifs_origine o where o.type = t.type and o.duree_jours = t.duree_jours;
-- Les crédits inclus d'origine reviennent (la section 0049 a remis les prix seuls).
update public.tarifs_abonnement t set credits_inclus = o.credits_inclus
  from tarifs_abo_origine o where o.formule = t.formule;
select pg_temp.check('0050 : credits inclus pre-remplis, Business 10, Pro 0',
  (select string_agg(formule || '=' || credits_inclus, ',' order by formule) from public.tarifs_abonnement)
    = 'business=10,pro=0');

-- Les droits.
select pg_temp.check('0050 : les fonctions de credits sont fermees a anon, ouvertes a authenticated',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.fixer_credits_inclus(text, int)', 'public.demander_credits(int)',
       'public.declarer_paiement_credits(uuid, text, text, text)', 'public.annuler_achat_credits(uuid)',
       'public.decider_achat_credits(uuid, boolean, text)', 'public.marquer_achat_credits_rembourse(uuid)',
       'public.payer_campagne_en_credits(uuid)', 'public.corriger_credits(uuid, int, text)',
       'public.mes_credits()', 'public.credits_equipe()', 'public.achats_credits_equipe()',
       'public.revenus_credits()']) as f));
select pg_temp.check('0050 : les fonctions internes ne s''appellent ni par anon ni par authenticated',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and not has_function_privilege('authenticated', f, 'execute'))
     from unnest(array[
       'public.solde_credits(uuid)', 'public.prendre_credits(uuid, int, uuid)', 'public.rendre_credits(uuid)',
       'public.abonnement_donne_ses_credits()', 'public.campagne_supprimee_rend_ses_credits()']) as f));
select pg_temp.check('0050 : personne n''ecrit un achat, un lot ni une consommation directement',
  (select bool_and(not has_table_privilege(r, t, p))
     from unnest(array['anon', 'authenticated']) r,
          unnest(array['public.achats_credits', 'public.lots_credits', 'public.consommations_credits']) t,
          unnest(array['insert', 'update', 'delete', 'truncate']) p)
  and (select bool_and(not has_table_privilege('anon', t, 'select'))
         from unnest(array['public.achats_credits', 'public.lots_credits', 'public.consommations_credits']) t)
  and not has_column_privilege('authenticated', 'public.tarifs_abonnement', 'credits_inclus', 'update'));

-- Les contraintes.
select pg_temp.refuse('0050 : un lot ne garde pas plus que ce qu''il avait (contrainte)',
  $q$insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants, disponible_at, expire_at, motif)
     values ('a0500000-0000-0000-0000-0000000000a1', 'equipe', 5, 6, now(), now() + interval '1 day', 'Essai')$q$);
select pg_temp.refuse('0050 : un lot ne descend pas sous zero (contrainte)',
  $q$insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants, disponible_at, expire_at, motif)
     values ('a0500000-0000-0000-0000-0000000000a1', 'equipe', 5, -1, now(), now() + interval '1 day', 'Essai')$q$);
select pg_temp.refuse('0050 : un lot d''achat porte son achat (contrainte)',
  $q$insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants, disponible_at, expire_at)
     values ('a0500000-0000-0000-0000-0000000000a1', 'achat', 5, 5, now(), now() + interval '1 day')$q$);
select pg_temp.refuse('0050 : un lot de l''equipe est motive (contrainte)',
  $q$insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants, disponible_at, expire_at)
     values ('a0500000-0000-0000-0000-0000000000a1', 'equipe', 5, 5, now(), now() + interval '1 day')$q$);
select pg_temp.refuse('0050 : un achat hors pack est refuse (contrainte)',
  $q$insert into public.achats_credits (merchant_id, credits, prix_gnf) values ('a0500000-0000-0000-0000-0000000000a1', 15, 15000)$q$);
select pg_temp.refuse('0050 : un credit vaut 1 000 GNF (contrainte)',
  $q$insert into public.achats_credits (merchant_id, credits, prix_gnf) values ('a0500000-0000-0000-0000-0000000000a1', 10, 9000)$q$);
select pg_temp.refuse('0050 : une campagne ne se paie pas par un moyen inconnu (contrainte)',
  $q$insert into public.campagnes (merchant_id, type, duree_jours, paiement_moyen)
     values ('a0500000-0000-0000-0000-0000000000a1', 'boutique', 3, 'bitcoin')$q$);

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.refuse('0050 : un visiteur ne lit pas les lots', 'select 1 from public.lots_credits');
select pg_temp.refuse('0050 : un visiteur ne lit pas les achats', 'select 1 from public.achats_credits');
select pg_temp.refuse('0050 : un visiteur ne lit pas son solde', 'select * from public.mes_credits()');
reset role;


-- Acheter : demander (U), déclarer, valider (S).
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000c');
select pg_temp.refuse('0050 : un client n''achete pas de credits',
  'select public.demander_credits(10)', 'boutiques en ligne');
select pg_temp.check('0050 : un client n''a pas de solde (zero ligne)',
  not exists (select 1 from public.mes_credits()));
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.check('0050 : une boutique sans credits a un solde de 0',
  (select disponibles = 0 and expirent_sous_30_jours = 0 and prochaine_expiration is null from public.mes_credits()));
select pg_temp.refuse('0050 : un pack inconnu est refuse',
  'select public.demander_credits(15)', 'pack de 10, 25 ou 50');
select pg_temp.refuse('0050 : un pack nul est refuse',
  'select public.demander_credits(null)', 'pack de 10, 25 ou 50');
insert into t50 (nom, id) select 'u_10', public.demander_credits(10);
select pg_temp.refuse('0050 : une seule demande de credits a la fois',
  'select public.demander_credits(25)', 'déjà en cours');
select pg_temp.refuse('0050 : le commercant n''ecrit pas son achat directement',
  $q$update public.achats_credits set statut = 'active'$q$);
select pg_temp.refuse('0050 : le commercant ne se cree pas de lot',
  $q$insert into public.lots_credits (merchant_id, origine, credits_initiaux, credits_restants, disponible_at, expire_at, motif)
     values ('a0500000-0000-0000-0000-0000000000a1', 'equipe', 99, 99, now(), now() + interval '1 year', 'Triche')$q$);
reset role;
select pg_temp.check('0050 : une demande nait a payer, au prix du pack (10 x 1 000 GNF)',
  (select statut = 'a_payer' and credits = 10 and prix_gnf = 10000 and paiement_declare_at is null
     from public.achats_credits where id = (select id from t50 where nom = 'u_10')));

set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000b');
select pg_temp.refuse('0050 : un commercant ne declare pas le paiement de l''achat d''un autre',
  format($q$select public.declarer_paiement_credits(%L, 'orange_money', 'OM500001', '620112233')$q$,
         (select id from t50 where nom = 'u_10')), 'introuvable');
select pg_temp.refuse('0050 : un commercant n''annule pas l''achat d''un autre',
  format('select public.annuler_achat_credits(%L)', (select id from t50 where nom = 'u_10')), 'introuvable');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0050 : l''equipe ne valide pas un achat a payer',
  format('select public.decider_achat_credits(%L, true)', (select id from t50 where nom = 'u_10')), 'pas encore déclaré');
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0050 : un moyen inactif est refuse pour un achat',
  format($q$select public.declarer_paiement_credits(%L, 'mtn_momo', 'MP500001', '620112233')$q$,
         (select id from t50 where nom = 'u_10')), 'pas ouvert');
select pg_temp.refuse('0050 : le commercant ne declare pas des especes pour un achat',
  format($q$select public.declarer_paiement_credits(%L, 'especes', 'ES500001', '620112233')$q$,
         (select id from t50 where nom = 'u_10')), 'Orange Money');
select pg_temp.refuse('0050 : une reference d''achat trop courte est refusee',
  format($q$select public.declarer_paiement_credits(%L, 'orange_money', 'ab', '620112233')$q$,
         (select id from t50 where nom = 'u_10')), 'référence');
select pg_temp.refuse('0050 : un numero payeur d''achat invalide est refuse',
  format($q$select public.declarer_paiement_credits(%L, 'orange_money', 'OM500001', '62')$q$,
         (select id from t50 where nom = 'u_10')), 'chiffres');
select public.declarer_paiement_credits((select id from t50 where nom = 'u_10'), 'orange_money', ' OM500001 ', '620 11-22.33');
select pg_temp.refuse('0050 : un commercant ne valide pas son achat',
  format('select public.decider_achat_credits(%L, true)', (select id from t50 where nom = 'u_10')), 'équipe');
select pg_temp.check('0050 : declarer ne donne pas encore de credits',
  pg_temp.solde_u() = 0);
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_achat_credits((select id from t50 where nom = 'u_10'), true);
select pg_temp.refuse('0050 : un achat ne se decide qu''une fois',
  format('select public.decider_achat_credits(%L, false, %L)', (select id from t50 where nom = 'u_10'), 'Trop tard'),
  'déjà été décidé');
reset role;
insert into t50 (nom, id) select 'lot_achat', l.id from public.lots_credits l
 where l.achat_id = (select id from t50 where nom = 'u_10');
select pg_temp.check('0050 : valider un achat confirme le paiement et cree un lot de 12 mois',
  (select statut = 'active' and paiement_moyen = 'orange_money' and paiement_reference = 'OM500001'
          and paiement_numero = '620112233'
          and paiement_confirme_par = 'a0420000-0000-0000-0000-000000000005' and paiement_confirme_at is not null
          and decidee_par = 'a0420000-0000-0000-0000-000000000005'
     from public.achats_credits where id = (select id from t50 where nom = 'u_10'))
  and (select l.origine = 'achat' and l.credits_initiaux = 10 and l.credits_restants = 10
              and l.merchant_id = 'a0500000-0000-0000-0000-0000000000a1'
              and l.disponible_at = a.decidee_at and l.expire_at = a.decidee_at + interval '12 months'
         from public.lots_credits l join public.achats_credits a on a.id = l.achat_id
        where l.id = (select id from t50 where nom = 'lot_achat'))
  and exists (select 1 from public.journal_equipe
               where action = 'valider_achat_credits' and cible_type = 'achat_credits'
                 and cible_id = (select id from t50 where nom = 'u_10')
                 and motif = 'Paiement vérifié : 10 crédits, 10000 GNF, orange_money OM500001'));

set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.check('0050 : la boutique a 10 credits, qui expirent dans 12 mois',
  (select m.disponibles = 10 and m.expirent_sous_30_jours = 0
          and m.prochaine_expiration = (pg_temp.lot('lot_achat')).expire_at
     from public.mes_credits() m));
select pg_temp.refuse('0050 : un achat valide ne s''annule pas',
  format('select public.annuler_achat_credits(%L)', (select id from t50 where nom = 'u_10')), 'ne peut plus');

-- Refuser (motif), rembourser ; annuler sans payer.
insert into t50 (nom, id) select 'u_25', public.demander_credits(25);
select public.declarer_paiement_credits((select id from t50 where nom = 'u_25'), 'orange_money', 'OM500002', '620112233');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0050 : refuser un achat exige un motif',
  format('select public.decider_achat_credits(%L, false)', (select id from t50 where nom = 'u_25')), 'motif');
select public.decider_achat_credits((select id from t50 where nom = 'u_25'), false, 'Reference introuvable');
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
insert into t50 (nom, id) select 'u_50', public.demander_credits(50);
select public.annuler_achat_credits((select id from t50 where nom = 'u_50'));
select pg_temp.check('0050 : refuser ou annuler un achat ne donne aucun credit',
  pg_temp.solde_u() = 10
  and not exists (select 1 from public.lots_credits l
                   where l.achat_id in (select id from t50 where nom in ('u_25', 'u_50'))));
select pg_temp.refuse('0050 : un commercant ne se note pas rembourse',
  format('select public.marquer_achat_credits_rembourse(%L)', (select id from t50 where nom = 'u_25')), 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0050 : un achat valide ne se rembourse pas',
  format('select public.marquer_achat_credits_rembourse(%L)', (select id from t50 where nom = 'u_10')), 'refusé ou annulé');
select pg_temp.refuse('0050 : un achat annule jamais paye ne se rembourse pas',
  format('select public.marquer_achat_credits_rembourse(%L)', (select id from t50 where nom = 'u_50')), 'Rien n''a été payé');
select public.marquer_achat_credits_rembourse((select id from t50 where nom = 'u_25'));
select pg_temp.refuse('0050 : un remboursement d''achat ne se note qu''une fois',
  format('select public.marquer_achat_credits_rembourse(%L)', (select id from t50 where nom = 'u_25')), 'déjà remboursé');
reset role;
select pg_temp.check('0050 : refus et remboursement signes et dans l''historique',
  (select statut = 'refusee' and motif = 'Reference introuvable'
          and rembourse_par = 'a0420000-0000-0000-0000-000000000005' and rembourse_at is not null
     from public.achats_credits where id = (select id from t50 where nom = 'u_25'))
  and (select statut from public.achats_credits where id = (select id from t50 where nom = 'u_50')) = 'annulee'
  and exists (select 1 from public.journal_equipe
               where action = 'refuser_achat_credits' and cible_id = (select id from t50 where nom = 'u_25'))
  and exists (select 1 from public.journal_equipe
               where action = 'rembourser_achat_credits' and cible_type = 'achat_credits'
                 and cible_id = (select id from t50 where nom = 'u_25') and motif = '25000 GNF, orange_money OM500002'));


-- Les crédits inclus : réglage par l'équipe, lot à chaque période Business.
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0050 : le commercant ne regle pas les credits inclus',
  $q$select public.fixer_credits_inclus('business', 99)$q$, 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0050 : credits inclus negatifs refuses',
  $q$select public.fixer_credits_inclus('business', -1)$q$, '0 à 1 000');
select pg_temp.refuse('0050 : credits inclus d''une formule inconnue refuses',
  $q$select public.fixer_credits_inclus('gratuit', 5)$q$, 'Formule inconnue');
select public.fixer_credits_inclus('business', 12);
reset role;
select pg_temp.check('0050 : regler les credits inclus les change, signe, et l''inscrit dans l''historique',
  (select credits_inclus = 12 and modifie_par = 'a0420000-0000-0000-0000-000000000005'
     from public.tarifs_abonnement where formule = 'business')
  and exists (select 1 from public.journal_equipe j join public.tarifs_abonnement t on t.id = j.cible_id
               where j.action = 'fixer_credits_inclus' and j.cible_type = 'tarif_abonnement'
                 and t.formule = 'business' and j.motif = 'business : 10 → 12 crédits par mois'));
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.fixer_credits_inclus('business', 10);

-- V : Business créé par l'équipe, puis Pro offert (0 crédit inclus).
insert into t50 (nom, id) select 'v_business', public.creer_abonnement_equipe(
  'a0500000-0000-0000-0000-0000000000b1', 'business', 'especes');
insert into t50 (nom, id) select 'v_pro', public.creer_abonnement_equipe(
  'a0500000-0000-0000-0000-0000000000b1', 'pro', 'offert');
reset role;
insert into t50 (nom, id) select 'lot_v_business', l.id from public.lots_credits l
 where l.abonnement_id = (select id from t50 where nom = 'v_business');
select pg_temp.check('0050 : un Business cree par l''equipe apporte 10 credits pour sa periode exacte',
  (select l.origine = 'abonnement' and l.credits_initiaux = 10 and l.credits_restants = 10
          and l.merchant_id = 'a0500000-0000-0000-0000-0000000000b1'
          and l.disponible_at = a.debut_at and l.expire_at = a.fin_at
     from public.lots_credits l join public.abonnements a on a.id = l.abonnement_id
    where l.id = (select id from t50 where nom = 'lot_v_business')));
select pg_temp.check('0050 : un Pro (0 credit inclus) n''apporte aucun lot',
  not exists (select 1 from public.lots_credits where abonnement_id = (select id from t50 where nom = 'v_pro')));

-- U : Business demandé, payé, validé ; puis renouvelé d'avance.
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
insert into t50 (nom, id) select 'u_business', public.demander_abonnement('business');
select public.declarer_paiement_abonnement((select id from t50 where nom = 'u_business'), 'orange_money', 'OM500003', '620112233');
reset role;
select pg_temp.check('0050 : un abonnement en attente n''apporte pas de credits',
  not exists (select 1 from public.lots_credits where abonnement_id = (select id from t50 where nom = 'u_business')));
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_abonnement((select id from t50 where nom = 'u_business'), true);
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
insert into t50 (nom, id) select 'u_business_2', public.demander_abonnement('business');
select public.declarer_paiement_abonnement((select id from t50 where nom = 'u_business_2'), 'orange_money', 'OM500004', '620112233');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_abonnement((select id from t50 where nom = 'u_business_2'), true);
reset role;
insert into t50 (nom, id) select 'lot_u_business', l.id from public.lots_credits l
 where l.abonnement_id = (select id from t50 where nom = 'u_business');
insert into t50 (nom, id) select 'lot_u_business_2', l.id from public.lots_credits l
 where l.abonnement_id = (select id from t50 where nom = 'u_business_2');
select pg_temp.check('0050 : un Business valide apporte ses credits pour sa periode',
  (select l.credits_restants = 10 and l.disponible_at = a.debut_at and l.expire_at = a.fin_at
     from public.lots_credits l join public.abonnements a on a.id = l.abonnement_id
    where l.id = (select id from t50 where nom = 'lot_u_business')));
select pg_temp.check('0050 : un renouvellement anticipe a un lot pas encore disponible',
  (select l.credits_restants = 10 and l.disponible_at = a.debut_at and l.disponible_at > now()
     from public.lots_credits l join public.abonnements a on a.id = l.abonnement_id
    where l.id = (select id from t50 where nom = 'lot_u_business_2')));
-- Des crédits expirés, qui ne doivent jamais servir.
insert into public.lots_credits (id, merchant_id, origine, credits_initiaux, credits_restants, disponible_at, expire_at, motif)
values ('a0500000-0000-0000-0000-0000000003e1', 'a0500000-0000-0000-0000-0000000000a1', 'equipe', 100, 100,
        now() - interval '13 months', now() - interval '1 month', 'Lot expire de test');
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.check('0050 : le solde compte achat + Business en cours, pas le lot futur ni l''expire',
  pg_temp.solde_u() = 20);


-- Payer une campagne en crédits.
insert into t50 (nom, id) select 'c1', public.demander_campagne('produit', pg_temp.u50(1), null, 7);
select pg_temp.login('a0500000-0000-0000-0000-00000000000b');
select pg_temp.refuse('0050 : un commercant ne paie pas en credits la campagne d''un autre',
  format('select public.payer_campagne_en_credits(%L)', (select id from t50 where nom = 'c1')), 'introuvable');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0050 : l''equipe ne paie pas en credits a la place du commercant',
  format('select public.payer_campagne_en_credits(%L)', (select id from t50 where nom = 'c1')), 'boutiques en ligne');
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select public.payer_campagne_en_credits((select id from t50 where nom = 'c1'));
reset role;
select pg_temp.check('0050 : payer en credits passe la campagne en attente, moyen credits, sans reference',
  (select statut = 'en_attente' and paiement_moyen = 'credits' and paiement_declare_at is not null
          and paiement_reference is null and paiement_numero is null and paiement_confirme_at is null
     from public.campagnes where id = (select id from t50 where nom = 'c1')));
select pg_temp.check('0050 : 15 credits pris, l''expiration la plus proche d''abord (Business 10, puis achat 5)',
  (pg_temp.lot('lot_u_business')).credits_restants = 0
  and (pg_temp.lot('lot_achat')).credits_restants = 5
  and (pg_temp.lot('lot_u_business_2')).credits_restants = 10
  and (select credits_restants from public.lots_credits where id = 'a0500000-0000-0000-0000-0000000003e1') = 100
  and (select string_agg(c.credits::text, ',' order by l.expire_at)
         from public.consommations_credits c join public.lots_credits l on l.id = c.lot_id
        where c.campagne_id = (select id from t50 where nom = 'c1') and c.rendu_at is null) = '10,5');
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.check('0050 : apres paiement, il reste 5 credits',
  pg_temp.solde_u() = 5);
select pg_temp.refuse('0050 : une campagne ne se paie pas deux fois en credits',
  format('select public.payer_campagne_en_credits(%L)', (select id from t50 where nom = 'c1')), 'n''attend pas de paiement');
select pg_temp.refuse('0050 : une campagne payee en credits ne se declare pas en argent ensuite',
  format($q$select public.declarer_paiement(%L, 'orange_money', 'OM500005', '620112233')$q$,
         (select id from t50 where nom = 'c1')), 'déjà payée en crédits');
-- Solde insuffisant : rien n'est pris (le lot expiré de 100 et le lot futur ne comptent pas).
insert into t50 (nom, id) select 'c2', public.demander_campagne('boutique', null, null, 30);
select pg_temp.refuse('0050 : solde insuffisant, avec ce qu''il faut et ce qu''on a',
  format('select public.payer_campagne_en_credits(%L)', (select id from t50 where nom = 'c2')),
  'Crédits insuffisants : il vous en faut 60, vous en avez 5.');
select pg_temp.check('0050 : un paiement refuse ne prend rien',
  pg_temp.solde_u() = 5
  and (select statut from public.campagnes where id = (select id from t50 where nom = 'c2')) = 'a_payer'
  and not exists (select 1 from public.consommations_credits where campagne_id = (select id from t50 where nom = 'c2')));
-- Un prix qui n'est pas un multiple de 1 000 GNF.
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.fixer_tarif('categorie', 3, 5500);
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
insert into t50 (nom, id) select 'c3', public.demander_campagne('categorie', pg_temp.u50(2), 1, 3);
select pg_temp.refuse('0050 : un prix qui n''est pas un multiple de 1 000 GNF ne se paie pas en credits',
  format('select public.payer_campagne_en_credits(%L)', (select id from t50 where nom = 'c3')), '1 crédit = 1 000 GNF');
select public.annuler_campagne((select id from t50 where nom = 'c2'));
select public.annuler_campagne((select id from t50 where nom = 'c3'));
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.fixer_tarif('categorie', 3, 5000);
reset role;
select pg_temp.check('0050 : annuler une campagne sans credits ne donne rien',
  (pg_temp.lot('lot_achat')).credits_restants = 5);

-- L'équipe valide une campagne payée en crédits : paiement confirmé, pas un revenu de publicité.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
insert into t50 (nom, n) select 'rev_pub_avant', coalesce(sum(encaisse_gnf), 0) from public.revenus_publicite();
select public.decider_campagne((select id from t50 where nom = 'c1'), true);
select pg_temp.check('0050 : revenus_publicite ne compte pas une campagne payee en credits',
  (select coalesce(sum(encaisse_gnf), 0) from public.revenus_publicite())
    = (select n from t50 where nom = 'rev_pub_avant'));
reset role;
select pg_temp.check('0050 : valider une campagne payee en credits la met en ligne et confirme le paiement',
  (select statut = 'active' and paiement_confirme_par = 'a0420000-0000-0000-0000-000000000005'
          and paiement_confirme_at is not null and fin_at = debut_at + interval '7 days'
     from public.campagnes where id = (select id from t50 where nom = 'c1'))
  and exists (select 1 from public.journal_equipe
               where action = 'valider_campagne' and cible_id = (select id from t50 where nom = 'c1')
                 and motif = 'Payée en crédits : 15 crédits'));
-- Interrompue en cours : rien ne revient, rien ne se rembourse en argent.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.interrompre_campagne((select id from t50 where nom = 'c1'), 'Photo trompeuse');
select pg_temp.refuse('0050 : une campagne payee en credits ne se rembourse pas en argent',
  format('select public.marquer_rembourse(%L)', (select id from t50 where nom = 'c1')), 'rien à rembourser en argent');
reset role;
select pg_temp.check('0050 : une campagne interrompue en cours ne rend pas ses credits',
  (pg_temp.lot('lot_achat')).credits_restants = 5 and (pg_temp.lot('lot_u_business')).credits_restants = 0
  and not exists (select 1 from public.consommations_credits
                   where campagne_id = (select id from t50 where nom = 'c1') and rendu_at is not null));


-- L'équipe corrige un solde.
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.refuse('0050 : un commercant ne corrige pas son solde',
  $q$select public.corriger_credits('a0500000-0000-0000-0000-0000000000a1', 100, 'Cadeau a moi-meme')$q$, 'équipe');
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.refuse('0050 : corriger exige un motif',
  $q$select public.corriger_credits('a0500000-0000-0000-0000-0000000000a1', 20, ' ab ')$q$, 'motif');
select pg_temp.refuse('0050 : corriger de 0 est refuse',
  $q$select public.corriger_credits('a0500000-0000-0000-0000-0000000000a1', 0, 'Rien du tout')$q$, 'nombre de crédits');
select pg_temp.refuse('0050 : corriger une boutique inconnue est refuse',
  $q$select public.corriger_credits('a0500000-0000-0000-0000-0000000000ff', 20, 'Geste commercial')$q$, 'introuvable');
select pg_temp.refuse('0050 : retirer plus que le solde est refuse',
  $q$select public.corriger_credits('a0500000-0000-0000-0000-0000000000a1', -6, 'Erreur de saisie')$q$,
  'n''a que 5 crédits disponibles');
select public.corriger_credits('a0500000-0000-0000-0000-0000000000a1', 20, 'Geste commercial');
reset role;
insert into t50 (nom, id) select 'lot_equipe', l.id from public.lots_credits l
 where l.merchant_id = 'a0500000-0000-0000-0000-0000000000a1' and l.origine = 'equipe' and l.motif = 'Geste commercial';
select pg_temp.check('0050 : offrir des credits cree un lot de 12 mois, signe, dans l''historique',
  (select l.credits_initiaux = 20 and l.credits_restants = 20 and l.cree_par = 'a0420000-0000-0000-0000-000000000005'
          and l.disponible_at > now() - interval '1 minute' and l.expire_at = l.disponible_at + interval '12 months'
     from public.lots_credits l where l.id = (select id from t50 where nom = 'lot_equipe'))
  and exists (select 1 from public.journal_equipe
               where action = 'corriger_credits' and cible_type = 'boutique'
                 and cible_id = 'a0500000-0000-0000-0000-0000000000a1' and motif = '+20 crédits : Geste commercial'));


-- Les crédits reviennent : refus, annulation avant le début, produit supprimé.
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
insert into t50 (nom, id) select 'c4', public.demander_campagne('produit', pg_temp.u50(2), null, 3);
select public.payer_campagne_en_credits((select id from t50 where nom = 'c4'));
select pg_temp.check('0050 : 7 credits pris (achat 5 puis equipe 2)',
  pg_temp.solde_u() = 18 and (pg_temp.lot('lot_achat')).credits_restants = 0
  and (pg_temp.lot('lot_equipe')).credits_restants = 18);
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_campagne((select id from t50 where nom = 'c4'), false, 'Produit interdit');
reset role;
select pg_temp.check('0050 : une campagne refusee rend ses credits a leurs lots, meme expiration',
  (pg_temp.lot('lot_achat')).credits_restants = 5 and (pg_temp.lot('lot_equipe')).credits_restants = 20
  and (pg_temp.lot('lot_achat')).expire_at
        = (select decidee_at + interval '12 months' from public.achats_credits where id = (select id from t50 where nom = 'u_10'))
  and (select count(*) = 2 and bool_and(rendu_at is not null)
         from public.consommations_credits where campagne_id = (select id from t50 where nom = 'c4')));

set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
insert into t50 (nom, id) select 'c5', public.demander_campagne('produit', pg_temp.u50(3), null, 3);
select public.payer_campagne_en_credits((select id from t50 where nom = 'c5'));
select public.annuler_campagne((select id from t50 where nom = 'c5'));
select pg_temp.check('0050 : une campagne annulee avant son debut rend ses credits',
  pg_temp.solde_u() = 25
  and (select statut from public.campagnes where id = (select id from t50 where nom = 'c5')) = 'annulee');

insert into t50 (nom, id) select 'c6', public.demander_campagne('produit', pg_temp.u50(4), null, 3);
select public.payer_campagne_en_credits((select id from t50 where nom = 'c6'));
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.decider_campagne((select id from t50 where nom = 'c6'), true);
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select public.annuler_campagne((select id from t50 where nom = 'c6'));
select pg_temp.check('0050 : une campagne annulee en cours ne rend pas ses credits',
  pg_temp.solde_u() = 18
  and (select statut from public.campagnes where id = (select id from t50 where nom = 'c6')) = 'annulee');

insert into t50 (nom, id) select 'c7', public.demander_campagne('produit', pg_temp.u50(3), null, 3);
select public.payer_campagne_en_credits((select id from t50 where nom = 'c7'));
select pg_temp.check('0050 : avant suppression du produit, 7 credits pris',
  pg_temp.solde_u() = 11);
delete from public.products where id = pg_temp.u50(3);
select pg_temp.check('0050 : supprimer le produit d''une campagne pas encore commencee rend ses credits',
  pg_temp.solde_u() = 18
  and not exists (select 1 from public.campagnes where id = (select id from t50 where nom = 'c7')));

-- Retirer : l'expiration la plus proche d'abord (un lot de 3 qui expire dans 10 jours).
reset role;
insert into public.lots_credits (id, merchant_id, origine, credits_initiaux, credits_restants, disponible_at, expire_at, motif)
values ('a0500000-0000-0000-0000-0000000003e2', 'a0500000-0000-0000-0000-0000000000a1', 'equipe', 3, 3,
        now() - interval '1 day', now() + interval '10 days', 'Bientot expire');
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.corriger_credits('a0500000-0000-0000-0000-0000000000a1', -2, 'Erreur de saisie');
reset role;
select pg_temp.check('0050 : retirer des credits prend l''expiration la plus proche d''abord',
  (select credits_restants from public.lots_credits where id = 'a0500000-0000-0000-0000-0000000003e2') = 1
  and (pg_temp.lot('lot_equipe')).credits_restants = 18
  and exists (select 1 from public.journal_equipe
               where action = 'corriger_credits' and cible_id = 'a0500000-0000-0000-0000-0000000000a1'
                 and motif = '-2 crédits : Erreur de saisie'));


-- L'interruption d'un abonnement fait expirer son lot à l'instant.
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000b');
select pg_temp.check('0050 : V a les 10 credits de son Business',
  (select disponibles from public.mes_credits()) = 10);
insert into t50 (nom, id) select 'cv', public.demander_campagne('produit', 'a0500000-0000-0000-0000-000000000201', null, 3);
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.interrompre_abonnement((select id from t50 where nom = 'v_business'), 'Paiement contrefait');
select public.interrompre_abonnement((select id from t50 where nom = 'u_business_2'), 'Renouvellement par erreur');
reset role;
select pg_temp.check('0050 : un abonnement interrompu fait expirer son lot, restants inchanges',
  (select l.credits_restants = 10 and l.expire_at <= now() and l.expire_at > now() - interval '1 minute'
     from public.lots_credits l where l.id = (select id from t50 where nom = 'lot_v_business'))
  and (select l.credits_restants = 10 and l.expire_at <= now() and l.disponible_at <= l.expire_at
         from public.lots_credits l where l.id = (select id from t50 where nom = 'lot_u_business_2')));
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000b');
select pg_temp.refuse('0050 : des credits expires ne se depensent pas',
  format('select public.payer_campagne_en_credits(%L)', (select id from t50 where nom = 'cv')),
  'il vous en faut 7, vous en avez 0.');
select public.annuler_campagne((select id from t50 where nom = 'cv'));


-- Ce que chacun lit.
reset role;
set role authenticated;
select pg_temp.login('a0500000-0000-0000-0000-00000000000a');
select pg_temp.check('0050 : mes_credits dit le solde, ce qui expire sous 30 jours, et quand',
  (select m.disponibles = 19 and m.expirent_sous_30_jours = 1
          and m.prochaine_expiration > now() + interval '9 days' and m.prochaine_expiration < now() + interval '11 days'
     from public.mes_credits() m));
select pg_temp.check('0050 : la boutique ne lit que ses lots, achats et consommations',
  (select count(*) from public.lots_credits) = 6
  and not exists (select 1 from public.lots_credits where merchant_id <> 'a0500000-0000-0000-0000-0000000000a1')
  and (select count(*) from public.achats_credits) = 3
  and exists (select 1 from public.consommations_credits)
  and not exists (select 1 from public.consommations_credits c
                   where c.lot_id not in (select l.id from public.lots_credits l)));
select pg_temp.refuse('0050 : un commercant ne lit pas les soldes de l''equipe',
  'select * from public.credits_equipe()', 'équipe');
select pg_temp.refuse('0050 : un commercant ne lit pas la file des achats',
  'select * from public.achats_credits_equipe()', 'équipe');
select pg_temp.refuse('0050 : un commercant ne lit pas les revenus des credits',
  'select * from public.revenus_credits()', 'équipe');
select pg_temp.login('a0500000-0000-0000-0000-00000000000b');
select pg_temp.check('0050 : une autre boutique ne voit ni les lots, ni les achats, ni les consommations de U',
  not exists (select 1 from public.lots_credits where merchant_id = 'a0500000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.achats_credits)
  and not exists (select 1 from public.consommations_credits));
select pg_temp.login('a0500000-0000-0000-0000-00000000000c');
select pg_temp.check('0050 : un client ne lit aucun lot, achat ni consommation',
  not exists (select 1 from public.lots_credits) and not exists (select 1 from public.achats_credits)
  and not exists (select 1 from public.consommations_credits));
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0050 : l''equipe lit tous les lots et consommations',
  (select count(*) from public.lots_credits where merchant_id = 'a0500000-0000-0000-0000-0000000000b1') = 1
  and (select count(*) from public.consommations_credits) = 6);
select pg_temp.check('0050 : les soldes de l''equipe : boutiques avec solde ou achat seulement',
  (select string_agg(c.shop_name || '=' || c.disponibles, ',') from public.credits_equipe() c) = 'Chez U50=19');
select pg_temp.check('0050 : la file des achats montre boutique, pack et paiement',
  exists (select 1 from public.achats_credits_equipe() ae
           where ae.id = (select id from t50 where nom = 'u_10') and ae.shop_name = 'Chez U50'
             and ae.merchant_id = 'a0500000-0000-0000-0000-0000000000a1' and ae.credits = 10
             and ae.prix_gnf = 10000 and ae.statut = 'active' and ae.paiement_moyen = 'orange_money'
             and ae.paiement_reference = 'OM500001' and ae.paiement_numero = '620112233'
             and ae.paiement_declare_at is not null and ae.paiement_confirme_at is not null
             and ae.rembourse_at is null and ae.creee_par_equipe is null)
  and exists (select 1 from public.achats_credits_equipe() ae
               where ae.id = (select id from t50 where nom = 'u_25') and ae.motif = 'Reference introuvable'
                 and ae.rembourse_at is not null)
  and (select count(*) from public.achats_credits_equipe()) = 3);
select pg_temp.check('0050 : les revenus des credits du mois (encaisse a la verification, remboursement compte)',
  (select encaisse_gnf = 10000 and rembourse_gnf = 25000 and achats = 1
     from public.revenus_credits()
    where mois = date_trunc('month', now() at time zone 'Africa/Conakry')::date)
  and (select count(*) from public.revenus_credits()) = 1);
reset role;

-- Une boutique supprimée avec une campagne payée en crédits en attente :
-- la suppression passe (le rendu ne vise pas un lot sans boutique). Le
-- paiement et la suppression dans la MÊME transaction : c'est là que la
-- clé étrangère du lot se revérifie (sans la garde, la suppression lève).
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select public.corriger_credits('a0500000-0000-0000-0000-0000000000b1', 10, 'Avant suppression');
begin;
select pg_temp.login('a0500000-0000-0000-0000-00000000000b');
select public.payer_campagne_en_credits(public.demander_campagne('produit', 'a0500000-0000-0000-0000-000000000201', null, 3));
reset role;
delete from auth.users where id = 'a0500000-0000-0000-0000-00000000000b';
commit;
select pg_temp.check('0050 : supprimer une boutique qui a une campagne payee en credits en attente reussit',
  not exists (select 1 from public.merchants where id = 'a0500000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.lots_credits where merchant_id = 'a0500000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.campagnes where merchant_id = 'a0500000-0000-0000-0000-0000000000b1'));

-- =====================================================================
-- 0051 : six produits sponsorisés au plus par appel
-- =====================================================================
-- Six boutiques X1 … X6 (puis X7), un produit publié chacune, une
-- campagne produit active chacune. Écrites en `postgres` : ce qui se teste
-- ici est le plafond de `produits_sponsorises`, pas le parcours de
-- paiement (testé en 0047 à 0050). D'autres campagnes actives des
-- sections précédentes peuvent rester : chaque contrôle tient quand même
-- (au moins 6 boutiques éligibles, et le plafond borne tout).
create or replace function pg_temp.x51(kind text, n int) returns uuid
language sql immutable as $$
  select ('a0510000-0000-0000-0000-' || kind || lpad(n::text, 10, '0'))::uuid
$$;
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.x51('00', n), 'x' || n || '0051@test.gn',
       jsonb_build_object('role', 'merchant', 'full_name', 'Marchand X' || n, 'phone', '62005100' || n)
  from generate_series(1, 7) n;
update public.profiles set id = auth_user_id
 where auth_user_id in (select pg_temp.x51('00', n) from generate_series(1, 7) n);
insert into public.merchants (id, profile_id, shop_name, city_id)
select pg_temp.x51('a1', n), pg_temp.x51('00', n), 'Chez X' || n || '51', 1 from generate_series(1, 7) n;
insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
select pg_temp.x51('c1', n), pg_temp.x51('a1', n), 1, 'Produit X' || n, 1000 * n, 'draft' from generate_series(1, 7) n;
insert into public.product_images (product_id, storage_path, position)
select pg_temp.x51('c1', n), 'a0510000/x' || n || '/0.webp', 0 from generate_series(1, 7) n;
update public.products set status = 'active' where id in (select pg_temp.x51('c1', n) from generate_series(1, 7) n);
insert into public.campagnes (merchant_id, type, product_id, duree_jours, prix_gnf, statut, debut_at, fin_at)
select pg_temp.x51('a1', n), 'produit', pg_temp.x51('c1', n), 7, 0, 'active', now() - interval '1 hour', now() + interval '7 days'
  from generate_series(1, 6) n;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0051 : six campagnes produit actives, p_limit => 5 en rend 5 (accueil)',
  (select count(*) from public.produits_sponsorises(p_limit => 5)) = 5
  and (select count(distinct merchant_id) from public.produits_sponsorises(p_limit => 5)) = 5);
select pg_temp.check('0051 : p_limit => 6 en rend 6',
  (select count(*) from public.produits_sponsorises(p_limit => 6)) = 6);
select pg_temp.check('0051 : p_limit => 50 n''en rend pas plus de 6',
  (select count(*) from public.produits_sponsorises(p_limit => 50)) <= 6);
select pg_temp.check('0051 : la recherche et les categories demandent 3, en ont 3',
  (select count(*) from public.produits_sponsorises(p_limit => 3)) = 3
  and (select count(*) from public.produits_sponsorises(null, 1, 3)) = 3);
reset role;

-- Une septième boutique éligible : le plafond tient encore à 6.
insert into public.campagnes (merchant_id, type, product_id, duree_jours, prix_gnf, statut, debut_at, fin_at)
values (pg_temp.x51('a1', 7), 'produit', pg_temp.x51('c1', 7), 7, 0, 'active', now() - interval '1 hour', now() + interval '7 days');
set role anon;
select pg_temp.check('0051 : sept boutiques eligibles, p_limit => 50 en rend exactement 6',
  (select count(*) from public.produits_sponsorises(p_limit => 50)) = 6
  and (select count(*) from public.produits_sponsorises(null, null, 1000)) = 6);
reset role;
select pg_temp.check('0051 : signature et droits inchanges (text, int, int), anon et authenticated',
  has_function_privilege('anon', 'public.produits_sponsorises(text, int, int)', 'execute')
  and has_function_privilege('authenticated', 'public.produits_sponsorises(text, int, int)', 'execute')
  and (select prosecdef and proconfig = array['search_path=""']
         from pg_proc where oid = 'public.produits_sponsorises(text, int, int)'::regprocedure));

\echo ''
\echo '===== TOUS LES TESTS SONT PASSES ====='
