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
truncate auth.users cascade;

-- 0074 masque toutes les catégories d'avant la mode, dont les trois que
-- les sections antérieures utilisent (ids 1, 2, 3 du jeu de 0003 :
-- alimentation, mode, electronique) ; un produit n'y entre plus. On garde
-- d'abord l'état laissé par les migrations (contrôlé dans la section
-- 0074), puis on rend ces trois-là visibles : pour ces sections, ce sont
-- des catégories ordinaires du catalogue, comme l'étaient toutes les
-- catégories quand elles ont été écrites. Aucun contrôle n'est relâché ;
-- la section 0074 prouve le masquage sur les autres catégories masquées.
drop table if exists pg_temp.categories_apres_migrations;
create temp table categories_apres_migrations as select * from public.categories;
update public.categories set visible = true where id in (1, 2, 3);

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

-- Entrer dans l'équipe marque ; en sortir démarque. Depuis 0076, un
-- compte qui a une activité (comme D) n'entre plus dans l'équipe : Q43
-- est une connexion neuve, sans activité.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0430000-0000-0000-0000-0000000000d4', 'q0043@test.gn', '{"role":"client","full_name":"Collegue Q43","phone":"620004304"}');
insert into public.equipe (auth_user_id, nom) values ('a0430000-0000-0000-0000-0000000000d4', 'Q43');
select pg_temp.check('0043 : entrer dans l''equipe marque la connexion',
  (select raw_app_meta_data ->> 'equipe' from auth.users where id = 'a0430000-0000-0000-0000-0000000000d4') = 'true');

-- Une annonce publiée maintenant n'atteint pas l'équipe.
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
insert into public.annonces (id, auteur_id, titre, corps, public, etat) values
  ('a0430000-0000-0000-0000-0000000000a1', 'a0420000-0000-0000-0000-000000000005', 'Apres 0043', 'Bonjour', 'tous', 'publiee');
reset role;
select pg_temp.check('0043 : une annonce ne part pas vers l''equipe',
  not exists (select 1 from public.annonce_destinataires
               where annonce_id = 'a0430000-0000-0000-0000-0000000000a1'
                 and auth_user_id in ('a0420000-0000-0000-0000-000000000005', 'a0430000-0000-0000-0000-0000000000d4'))
  and exists (select 1 from public.annonce_destinataires
               where annonce_id = 'a0430000-0000-0000-0000-0000000000a1'
                 and auth_user_id = '33333333-3333-3333-3333-333333333333'));

delete from public.equipe where auth_user_id = 'a0430000-0000-0000-0000-0000000000d4';
select pg_temp.check('0043 : sortir de l''equipe retire la marque, et elle seule',
  (select not (raw_app_meta_data ? 'equipe') from auth.users where id = 'a0430000-0000-0000-0000-0000000000d4'));

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
-- Un commerçant crée un produit sans le mettre « à la une » (0052)
-- =====================================================================
-- Avant 0052, `authenticated` avait INSERT sur toute la table : la
-- policy « je cree mes produits » acceptait la ligne (sa boutique, compte
-- actif) avec is_featured, contact_count ou masque_par_equipe choisis.
-- `pg_temp.refuse` : vrai si l'instruction est refusée par un DROIT
-- (« permission denied »), pas par le RLS (même code 42501, autre texte).
create or replace function pg_temp.refuse(q text) returns boolean
language plpgsql as $$
begin
  execute q;
  return false;
exception when insufficient_privilege then
  return sqlerrm like 'permission denied%';
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0520000-0000-0000-0000-00000000000a', 'm0052@test.gn', '{"role":"merchant","full_name":"Marchand M52","phone":"620005201"}');
update public.profiles set id = auth_user_id where auth_user_id = 'a0520000-0000-0000-0000-00000000000a';
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0520000-0000-0000-0000-0000000000a1', 'a0520000-0000-0000-0000-00000000000a', 'Chez M52', 1);

set role authenticated;
select pg_temp.login('a0520000-0000-0000-0000-00000000000a');
-- Exactement l'insertion du site et de l'app.
insert into public.products (id, merchant_id, category_id, title, description, price_gnf, is_negotiable, status)
values ('a0520000-0000-0000-0000-0000000000f1', 'a0520000-0000-0000-0000-0000000000a1', 1,
        'Riz de Kankan', null, 250000, true, 'draft');
reset role;
select pg_temp.check('0052 : l''insertion du site et de l''app passe, colonnes reservees a leur defaut',
  (select not is_featured and contact_count = 0 and not masque_par_equipe
          and created_at is not null and updated_at is not null and is_negotiable
     from public.products where id = 'a0520000-0000-0000-0000-0000000000f1'));

set role authenticated;
select pg_temp.login('a0520000-0000-0000-0000-00000000000a');
do $$
begin
  insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
  values ('a0520000-0000-0000-0000-0000000000f1', 'a0520000-0000-0000-0000-0000000000a1', 1, 'Riz de Kankan', 250000, 'draft');
  raise exception 'ECHEC 0052 : un doublon d''identifiant est passe';
exception when unique_violation then
  raise notice 'OK    0052 : un doublon d''identifiant renvoie unique_violation, comme l''attendent le site et l''app';
end $$;
select pg_temp.check('0052 : un commercant ne cree pas son produit « a la une »',
  pg_temp.refuse($q$insert into public.products (merchant_id, category_id, title, price_gnf, is_featured)
                    values ('a0520000-0000-0000-0000-0000000000a1', 1, 'Mis a la une', 1000, true)$q$));
select pg_temp.check('0052 : un commercant ne gonfle pas son compteur de contacts',
  pg_temp.refuse($q$insert into public.products (merchant_id, category_id, title, price_gnf, contact_count)
                    values ('a0520000-0000-0000-0000-0000000000a1', 1, 'Tres populaire', 1000, 999)$q$));
select pg_temp.check('0052 : un commercant ne pose pas masque_par_equipe',
  pg_temp.refuse($q$insert into public.products (merchant_id, category_id, title, price_gnf, status, masque_par_equipe)
                    values ('a0520000-0000-0000-0000-0000000000a1', 1, 'Faux masque', 1000, 'hidden', true)$q$));
select pg_temp.check('0052 : un commercant n''antidate ni ne postdate son produit',
  pg_temp.refuse($q$insert into public.products (merchant_id, category_id, title, price_gnf, created_at)
                    values ('a0520000-0000-0000-0000-0000000000a1', 1, 'Toujours nouveau', 1000, now() + interval '1 year')$q$)
  and pg_temp.refuse($q$insert into public.products (merchant_id, category_id, title, price_gnf, updated_at)
                    values ('a0520000-0000-0000-0000-0000000000a1', 1, 'Toujours frais', 1000, now() + interval '1 year')$q$));
reset role;
select pg_temp.check('0052 : aucun des refus n''a laisse de produit',
  (select count(*) from public.products where merchant_id = 'a0520000-0000-0000-0000-0000000000a1') = 1);
select pg_temp.check('0052 : anon n''a plus aucun droit d''insertion sur products',
  not has_table_privilege('anon', 'public.products', 'insert')
  and not has_any_column_privilege('anon', 'public.products', 'insert'));
-- Les huit colonnes de 0052, plus genre, tailles, couleurs de 0074 : la
-- liste reste EXACTE (aucune colonne réservée ne s'y glisse).
select pg_temp.check('0052 : authenticated insere exactement les huit colonnes envoyees (+ trois de 0074)',
  not has_table_privilege('authenticated', 'public.products', 'insert')
  and (select array_agg(attname::text order by attname::text)
         from pg_attribute
        where attrelid = 'public.products'::regclass and attnum > 0 and not attisdropped
          and has_column_privilege('authenticated', 'public.products', attname, 'insert'))
      = array['category_id', 'couleurs', 'description', 'genre', 'id', 'is_negotiable', 'merchant_id', 'price_gnf', 'status', 'tailles', 'title']);
set role anon;
select pg_temp.login('00000000-0000-0000-0000-000000000000');
select pg_temp.check('0052 : anon est refuse par le droit, avant meme le RLS',
  pg_temp.refuse($q$insert into public.products (merchant_id, category_id, title, price_gnf)
                    values ('a0520000-0000-0000-0000-0000000000a1', 1, 'Anonyme', 1000)$q$));
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- =====================================================================
-- Tables du serveur seul : essais de mot de passe (0053), notifications
-- déjà envoyées (0054)
-- =====================================================================
-- Aucune politique, aucun droit pour anon/authenticated : ni lecture, ni
-- écriture, même connecté. Seul service_role (le site) y touche.
select pg_temp.check('0053/0054 : RLS active sans aucune politique',
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.essais_mot_de_passe'::regclass, 'public.notifications_envoyees'::regclass))
  and not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename in ('essais_mot_de_passe', 'notifications_envoyees')));
select pg_temp.check('0053/0054 : anon et authenticated n''ont aucun droit sur les deux tables',
  not exists (
    select 1
      from unnest(array['anon', 'authenticated']) r,
           unnest(array['public.essais_mot_de_passe', 'public.notifications_envoyees']) t,
           unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p
     where has_table_privilege(r, t, p)
        or (p in ('select', 'insert', 'update', 'references') and has_any_column_privilege(r, t, p))));
select pg_temp.check('0053 : anon et authenticated ne touchent pas au compteur des essais',
  not has_sequence_privilege('anon', 'public.essais_mot_de_passe_id_seq', 'usage')
  and not has_sequence_privilege('authenticated', 'public.essais_mot_de_passe_id_seq', 'usage'));
select pg_temp.check('0053/0054 : seul le serveur lance les purges',
  not has_function_privilege('anon', 'public.purger_essais_mot_de_passe()', 'execute')
  and not has_function_privilege('authenticated', 'public.purger_essais_mot_de_passe()', 'execute')
  and not has_function_privilege('anon', 'public.purger_notifications_envoyees()', 'execute')
  and not has_function_privilege('authenticated', 'public.purger_notifications_envoyees()', 'execute')
  and has_function_privilege('service_role', 'public.purger_essais_mot_de_passe()', 'execute')
  and has_function_privilege('service_role', 'public.purger_notifications_envoyees()', 'execute'));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0530000-0000-0000-0000-00000000000c', 'c0053@test.gn', '{"role":"client","full_name":"Client C53","phone":"620005301"}');
-- Une ligne de chaque, écrite comme le fera le site, pour que les refus
-- de lecture aient quelque chose à cacher.
set role service_role;
insert into public.essais_mot_de_passe (auth_user_id) values ('a0530000-0000-0000-0000-00000000000c');
insert into public.notifications_envoyees (cle) values ('message:a0530000-0000-0000-0000-0000000000e1');
reset role;

set role authenticated;
select pg_temp.login('a0530000-0000-0000-0000-00000000000c');
select pg_temp.check('0053 : connecte, on ne lit pas ses propres essais',
  pg_temp.refuse('select count(*) from public.essais_mot_de_passe'));
select pg_temp.check('0053 : connecte, on n''ajoute ni n''efface d''essai',
  pg_temp.refuse($q$insert into public.essais_mot_de_passe (auth_user_id) values ('a0530000-0000-0000-0000-00000000000c')$q$)
  and pg_temp.refuse('delete from public.essais_mot_de_passe')
  and pg_temp.refuse('update public.essais_mot_de_passe set created_at = now() - interval ''1 day'''));
select pg_temp.check('0054 : connecte, on ne lit pas les notifications envoyees',
  pg_temp.refuse('select count(*) from public.notifications_envoyees'));
select pg_temp.check('0054 : connecte, on ne pose ni n''efface de cle (empecher ou rejouer une notification)',
  pg_temp.refuse($q$insert into public.notifications_envoyees (cle) values ('message:a0530000-0000-0000-0000-0000000000e2')$q$)
  and pg_temp.refuse('delete from public.notifications_envoyees')
  and pg_temp.refuse('update public.notifications_envoyees set cle = ''x'''));
select pg_temp.check('0053/0054 : connecte, purges refusees',
  pg_temp.refuse('select public.purger_essais_mot_de_passe()')
  and pg_temp.refuse('select public.purger_notifications_envoyees()'));
reset role;
set role anon;
select pg_temp.login('00000000-0000-0000-0000-000000000000');
select pg_temp.check('0053 : anon ne lit ni n''ecrit les essais',
  pg_temp.refuse('select count(*) from public.essais_mot_de_passe')
  and pg_temp.refuse($q$insert into public.essais_mot_de_passe (auth_user_id) values ('a0530000-0000-0000-0000-00000000000c')$q$)
  and pg_temp.refuse('delete from public.essais_mot_de_passe'));
select pg_temp.check('0054 : anon ne lit ni n''ecrit les notifications envoyees',
  pg_temp.refuse('select count(*) from public.notifications_envoyees')
  and pg_temp.refuse($q$insert into public.notifications_envoyees (cle) values ('equipe:a0530000-0000-0000-0000-0000000000e3')$q$)
  and pg_temp.refuse('delete from public.notifications_envoyees'));
reset role;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check('0053/0054 : les refus n''ont rien ecrit ni efface',
  (select count(*) from public.essais_mot_de_passe) = 1
  and (select count(*) from public.notifications_envoyees) = 1);

-- Le serveur : compter, dédoublonner, purger.
set role service_role;
select pg_temp.check('0053 : le serveur compte les echecs recents d''un compte',
  (select count(*) from public.essais_mot_de_passe
    where auth_user_id = 'a0530000-0000-0000-0000-00000000000c'
      and created_at > now() - interval '15 minutes') = 1);
do $$
declare n int;
begin
  insert into public.notifications_envoyees (cle) values ('message:a0530000-0000-0000-0000-0000000000e1')
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK    0054 : la meme cle ne se pose pas deux fois (le rappel ne sonne pas)';
  else raise exception 'ECHEC 0054 : une cle deja posee a ete reposee';
  end if;
  insert into public.notifications_envoyees (cle) values ('equipe:a0530000-0000-0000-0000-0000000000e1')
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK    0054 : une cle nouvelle se pose (la premiere fois sonne)';
  else raise exception 'ECHEC 0054 : une cle nouvelle n''a pas ete posee';
  end if;
end $$;
insert into public.essais_mot_de_passe (auth_user_id, created_at)
values ('a0530000-0000-0000-0000-00000000000c', now() - interval '25 hours');
insert into public.notifications_envoyees (cle, created_at)
values ('message:a0530000-0000-0000-0000-0000000000e9', now() - interval '25 hours');
select pg_temp.check('0053 : la purge efface les essais de plus d''un jour, garde les recents',
  public.purger_essais_mot_de_passe() = 1);
select pg_temp.check('0054 : la purge efface les cles de plus d''un jour, garde les recentes',
  public.purger_notifications_envoyees() = 1);
select pg_temp.check('0053/0054 : apres purge, il reste les lignes recentes',
  (select count(*) from public.essais_mot_de_passe) = 1
  and (select count(*) from public.notifications_envoyees) = 2);
reset role;

delete from auth.users where id = 'a0530000-0000-0000-0000-00000000000c';
select pg_temp.check('0053 : supprimer le compte efface ses essais',
  not exists (select 1 from public.essais_mot_de_passe
               where auth_user_id = 'a0530000-0000-0000-0000-00000000000c'));

-- =====================================================================
-- Une personne signalée par cinq personnes passe en tête (0055)
-- =====================================================================
-- S (équipe, 0042). R1..R6 : clients signaleurs. V : boutique « Chez V55 »
-- (5 produits). W : boutique « Chez W55 » (5 produits). K : client qui a un
-- fil avec chacune des boutiques M1..M5.
insert into auth.users (id, email, raw_user_meta_data)
select ('a0550000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'r' || i || '0055@test.gn',
       jsonb_build_object('role', 'client', 'full_name', 'Signaleur R' || i, 'phone', '62005510' || i)
  from generate_series(1, 6) i;
insert into auth.users (id, email, raw_user_meta_data)
select ('a0550000-0000-0000-0000-0000000004' || lpad(i::text, 2, '0'))::uuid, 'm' || i || '0055@test.gn',
       jsonb_build_object('role', 'merchant', 'full_name', 'Marchand M' || i, 'phone', '62005540' || i)
  from generate_series(1, 5) i;
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0550000-0000-0000-0000-0000000000a1', 'v0055@test.gn', '{"role":"merchant","full_name":"Marchand V","phone":"620005501"}'),
  ('a0550000-0000-0000-0000-0000000000a2', 'w0055@test.gn', '{"role":"merchant","full_name":"Marchand W","phone":"620005502"}'),
  ('a0550000-0000-0000-0000-0000000000c1', 'k0055@test.gn', '{"role":"client","full_name":"Client K55","phone":"620005503"}');
update public.profiles set id = auth_user_id where auth_user_id::text like 'a0550000-%';
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0550000-0000-0000-0000-0000000000b1', 'a0550000-0000-0000-0000-0000000000a1', 'Chez V55', 1),
  ('a0550000-0000-0000-0000-0000000000b2', 'a0550000-0000-0000-0000-0000000000a2', 'Chez W55', 1);
insert into public.merchants (id, profile_id, shop_name, city_id)
select ('a0550000-0000-0000-0000-0000000005' || lpad(i::text, 2, '0'))::uuid,
       ('a0550000-0000-0000-0000-0000000004' || lpad(i::text, 2, '0'))::uuid, 'Chez M' || i || '55', 1
  from generate_series(1, 5) i;
insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
select ('a0550000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid,
       'a0550000-0000-0000-0000-0000000000b1', 1, 'Produit V' || i, 10000, 'draft'
  from generate_series(1, 5) i;
insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
select ('a0550000-0000-0000-0000-0000000003' || lpad(i::text, 2, '0'))::uuid,
       'a0550000-0000-0000-0000-0000000000b2', 1, 'Produit W' || i, 10000, 'draft'
  from generate_series(1, 5) i;
insert into public.conversations (id, client_id, merchant_id)
select ('a0550000-0000-0000-0000-0000000006' || lpad(i::text, 2, '0'))::uuid,
       'a0550000-0000-0000-0000-0000000000c1',
       ('a0550000-0000-0000-0000-0000000005' || lpad(i::text, 2, '0'))::uuid
  from generate_series(1, 5) i;

select pg_temp.check('0055 : la fonction est fermee a anon, ouverte a authenticated',
  not has_function_privilege('anon', 'public.comptes_tres_signales()', 'execute')
  and has_function_privilege('authenticated', 'public.comptes_tres_signales()', 'execute'));

-- Quatre signaleurs distincts sur un produit de V.
insert into public.reports (reporter_id, target_type, target_id, reason)
select ('a0550000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'product',
       'a0550000-0000-0000-0000-000000000201', 'Photo trompeuse'
  from generate_series(1, 4) i;

-- W : R1 signale ses 5 produits, R2..R4 un chacun : 8 signalements,
-- 4 signaleurs. Un comptage de lignes la ferait passer.
insert into public.reports (reporter_id, target_type, target_id, reason)
select 'a0550000-0000-0000-0000-000000000101', 'product',
       ('a0550000-0000-0000-0000-0000000003' || lpad(i::text, 2, '0'))::uuid, 'Contrefacon'
  from generate_series(1, 5) i;
insert into public.reports (reporter_id, target_type, target_id, reason)
select ('a0550000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'product',
       'a0550000-0000-0000-0000-000000000301', 'Contrefacon'
  from generate_series(2, 4) i;

-- K : chacune des 5 boutiques signale SON fil avec K.
insert into public.reports (reporter_id, target_type, target_id, reason)
select ('a0550000-0000-0000-0000-0000000004' || lpad(i::text, 2, '0'))::uuid, 'conversation',
       ('a0550000-0000-0000-0000-0000000006' || lpad(i::text, 2, '0'))::uuid, 'Insultes'
  from generate_series(1, 5) i;

-- Hors équipe : refusé.
set role authenticated;
select pg_temp.login('a0550000-0000-0000-0000-000000000101');
do $$
begin
  perform public.comptes_tres_signales();
  raise exception 'ECHEC 0055 : un client lit les comptes tres signales';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    0055 : un non-membre de l''equipe est refuse';
end $$;

select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0055 : 4 signaleurs distincts ne suffisent pas',
  not exists (select 1 from public.comptes_tres_signales()
               where profile_id = 'a0550000-0000-0000-0000-0000000000a1'));
select pg_temp.check('0055 : 5 signalements d''un meme signaleur comptent pour 1 (W absente)',
  not exists (select 1 from public.comptes_tres_signales()
               where profile_id = 'a0550000-0000-0000-0000-0000000000a2'));
select pg_temp.check('0055 : conversation, c''est l''autre participant qui est vise',
  exists (select 1 from public.comptes_tres_signales()
           where profile_id = 'a0550000-0000-0000-0000-0000000000c1'
             and nom = 'Client K55' and role = 'client' and signaleurs = 5)
  and not exists (select 1 from public.comptes_tres_signales()
                   where profile_id::text like 'a0550000-0000-0000-0000-00000000040%'));
reset role;

-- Le cinquième signaleur vise la BOUTIQUE V, plus le produit.
insert into public.reports (id, reporter_id, target_type, target_id, reason) values
  ('a0550000-0000-0000-0000-0000000000d5', 'a0550000-0000-0000-0000-000000000105', 'merchant',
   'a0550000-0000-0000-0000-0000000000b1', 'Boutique douteuse');
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0055 : 5 signaleurs distincts (produit et boutique) : V present, nom de boutique, role',
  exists (select 1 from public.comptes_tres_signales()
           where profile_id = 'a0550000-0000-0000-0000-0000000000a1'
             and nom = 'Chez V55' and role = 'merchant' and signaleurs = 5
             and dernier_signalement = (select created_at from public.reports
                                         where id = 'a0550000-0000-0000-0000-0000000000d5')));
reset role;

-- Un signalement traité ne compte plus.
update public.reports set handled_at = now() where id = 'a0550000-0000-0000-0000-0000000000d5';
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0055 : un signalement traite ne compte plus',
  not exists (select 1 from public.comptes_tres_signales()
               where profile_id = 'a0550000-0000-0000-0000-0000000000a1'));
reset role;

-- R5 et R6 signalent un autre produit de V : 6 signaleurs, V passe devant K (5).
insert into public.reports (reporter_id, target_type, target_id, reason)
select ('a0550000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'product',
       'a0550000-0000-0000-0000-000000000202', 'Photo trompeuse'
  from generate_series(5, 6) i;
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0055 : le plus signale d''abord',
  (select array_agg(profile_id) from public.comptes_tres_signales())
    = array['a0550000-0000-0000-0000-0000000000a1', 'a0550000-0000-0000-0000-0000000000c1']::uuid[]);
reset role;

-- Un compte déjà suspendu n'y figure plus (il est dans comptes_suspendus).
update public.profiles set is_suspended = true, suspension_reason = 'Test 0055'
 where id = 'a0550000-0000-0000-0000-0000000000a1';
set role authenticated;
select pg_temp.login('a0420000-0000-0000-0000-000000000005');
select pg_temp.check('0055 : un compte suspendu est exclu',
  not exists (select 1 from public.comptes_tres_signales()
               where profile_id = 'a0550000-0000-0000-0000-0000000000a1'));
reset role;


-- =====================================================================
-- Une boutique créée reçoit un mot de bienvenue de l'équipe (0056)
-- =====================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0560000-0000-0000-0000-00000000000a', 'b0056@test.gn', '{"role":"merchant","full_name":"Marchande B","phone":"620005601"}'),
  ('a0560000-0000-0000-0000-00000000000b', 'c0056@test.gn', '{"role":"merchant","full_name":"Marchande C","phone":"620005602"}');
update public.profiles set id = auth_user_id where auth_user_id::text like 'a0560000-%';

select pg_temp.check('0056 : la fonction du declencheur n''est appelable par personne',
  not has_function_privilege('authenticated', 'public.boutique_creee_recoit_la_bienvenue()', 'execute')
  and not has_function_privilege('anon', 'public.boutique_creee_recoit_la_bienvenue()', 'execute'));

-- La boutique se crée comme dans l'app : insert direct de la commerçante.
set role authenticated;
select pg_temp.login('a0560000-0000-0000-0000-00000000000a');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0560000-0000-0000-0000-0000000000b1', 'a0560000-0000-0000-0000-00000000000a', 'Chez Bienvenue', 1);
select pg_temp.check('0056 : la commercante lit 1 message de l''equipe, non lu, dans son fil boutique',
  (select count(*) from public.fil_equipe) = 1
  and (select de_l_equipe and auteur_id is null and lu_at is null and espace = 'merchant'
              and fil_de = 'a0560000-0000-0000-0000-00000000000a'
              and corps like '🎉 Bienvenue sur Filloo !%'
         from public.fil_equipe));
reset role;
select pg_temp.check('0056/0071 : le texte est exactement celui ecrit par le porteur du projet (0071, 0072)',
  (select corps from public.fil_equipe where fil_de = 'a0560000-0000-0000-0000-00000000000a')
  = E'🎉 Bienvenue sur Filloo !\n\n'
    || E'Nous sommes ravis de vous compter parmi les commerçants de notre plateforme.\n\n'
    || E'Filloo vous permet de présenter vos produits et de les faire découvrir à de nouveaux clients.\n\n'
    || E'💡 Quelques conseils pour attirer davantage de clients :\n\n'
    || E'• Publiez des photos nettes, lumineuses et de bonne qualité.\n'
    || E'• Choisissez des photos qui montrent clairement vos produits.\n'
    || E'• Ajoutez des prix et des descriptions précises.\n'
    || E'• Prenez le temps de bien présenter chaque article.\n'
    || E'• Publiez régulièrement de nouveaux produits pour faire vivre votre boutique.\n\n'
    || E'Un conseil important : une belle présentation donne envie aux clients de découvrir vos produits et de vous contacter.\n\n'
    || E'Notre objectif est de vous accompagner dans le développement de votre activité.\n\n'
    || E'Bienvenue dans la communauté Filloo !');
select pg_temp.check('0071 : la fonction du texte n''est appelable par personne',
  not has_function_privilege('authenticated', 'public.texte_de_bienvenue_boutique()', 'execute')
  and not has_function_privilege('anon', 'public.texte_de_bienvenue_boutique()', 'execute'));

update public.merchants set description = 'Nouvelle description', shop_name = 'Chez Bienvenue 2'
 where id = 'a0560000-0000-0000-0000-0000000000b1';
select pg_temp.check('0056 : modifier la boutique n''ajoute aucun message',
  (select count(*) from public.fil_equipe where fil_de = 'a0560000-0000-0000-0000-00000000000a') = 1);

-- Jamais bloquant : un fil qui refuse tout n'empêche pas la boutique.
begin;
alter table public.fil_equipe add constraint t56_refuse_tout check (false) not valid;
set role authenticated;
select pg_temp.login('a0560000-0000-0000-0000-00000000000b');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0560000-0000-0000-0000-0000000000b2', 'a0560000-0000-0000-0000-00000000000b', 'Chez Panne', 1);
reset role;
select pg_temp.check('0056 : si le message echoue, la boutique se cree quand meme',
  exists (select 1 from public.merchants where id = 'a0560000-0000-0000-0000-0000000000b2')
  and not exists (select 1 from public.fil_equipe where fil_de = 'a0560000-0000-0000-0000-00000000000b'));
rollback;


-- =====================================================================
-- Les visiteurs uniques se comptent sans savoir qui ils sont (0057)
-- =====================================================================
select pg_temp.check('0057 : visiteur_id est un uuid facultatif',
  (select data_type = 'uuid' and is_nullable = 'YES' from information_schema.columns
    where table_schema = 'public' and table_name = 'analytics_events' and column_name = 'visiteur_id'));
select pg_temp.check('0057 : les mesures restent fermees a anon et authenticated',
  not has_table_privilege('anon', 'public.analytics_events', 'select')
  and not has_table_privilege('anon', 'public.analytics_events', 'insert')
  and not has_table_privilege('authenticated', 'public.analytics_events', 'select')
  and not has_table_privilege('authenticated', 'public.analytics_events', 'insert')
  and not has_function_privilege('anon', 'public.suivi_chiffres(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.suivi_chiffres(timestamptz)', 'execute'));
set role anon;
do $$
begin
  insert into public.analytics_events (name, visiteur_id) values ('visite', gen_random_uuid());
  raise exception 'ECHEC 0057 : un visiteur fabrique une mesure';
exception when insufficient_privilege then
  raise notice 'OK    0057 : un visiteur ne fabrique pas de mesure';
end $$;
reset role;

-- v1 : deux visites le 1er, une le 2 ; v2 : une le 1er ; une mesure sans
-- numéro (app) le 1er. Plus de 13 mois : la purge les emportera.
insert into public.analytics_events (name, occurred_at, visiteur_id) values
  ('visite',     '2000-01-01 08:00+00', 'a0570000-0000-0000-0000-0000000000a1'),
  ('produit_vu', '2000-01-01 09:00+00', 'a0570000-0000-0000-0000-0000000000a1'),
  ('visite',     '2000-01-01 10:00+00', 'a0570000-0000-0000-0000-0000000000a2'),
  ('visite',     '2000-01-01 11:00+00', null),
  ('visite',     '2000-01-02 08:00+00', 'a0570000-0000-0000-0000-0000000000a1');
create temp table t57 as select public.suivi_chiffres('2000-01-01 00:00+00') as c;
select pg_temp.check('0057 : visiteurs uniques sur la periode (null exclus)',
  (select (c->>'visiteurs_uniques')::int = 2 from t57));
select pg_temp.check('0057 : visiteurs distincts par jour',
  (select (j->>'visiteurs')::int = 2 and (j->>'visites')::int = 3
     from t57, jsonb_array_elements(c->'par_jour') j where j->>'jour' = '2000-01-01')
  and (select (j->>'visiteurs')::int = 1
     from t57, jsonb_array_elements(c->'par_jour') j where j->>'jour' = '2000-01-02'));
select pg_temp.check('0057 : toutes les cles de 0034 sont encore la',
  (select c ?& array['evenements', 'par_jour', 'recherches', 'recherches_vides', 'profils',
                     'boutiques', 'produits', 'messagerie', 'signalements', 'notifications']
          and (c->'par_jour'->0) ?& array['jour', 'visites', 'produits_vus', 'contacts', 'inscriptions', 'messages']
     from t57));
-- Deux instructions : une requête ne voit pas ce que sa propre purge efface.
select pg_temp.check('0057 : la purge de 0028 retire les 5 vieilles mesures', public.purger_mesures() = 5);
select pg_temp.check('0057 : la purge emporte aussi les numeros de visiteur',
  not exists (select 1 from public.analytics_events where visiteur_id is not null));



-- =====================================================================
-- L'équipe retrouve n'importe quel compte (0063)
-- =====================================================================
-- T : équipe. N : client hors équipe. M : commerçant « Mamadou Diallo »,
-- boutique « Boutique Kaloum Électro » (2 produits). C1 « Aïssatou
-- Barry ». C2 « barry », compte SUPPRIMÉ, le plus récent. C3 « Ami de
-- Mamadou », plus récent que M.
-- `pg_temp.erreur_de` : le message d'erreur d'une instruction, ou null.
create or replace function pg_temp.erreur_de(q text) returns text
language plpgsql as $$
begin
  execute q;
  return null;
exception when others then
  return sqlerrm;
end $$;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a0630000-0000-0000-0000-0000000000e1', 't0063@test.gn', '{"role":"client","full_name":"Equipier T63","phone":"620006301"}', now()),
  ('a0630000-0000-0000-0000-0000000000c9', 'n0063@test.gn', '{"role":"client","full_name":"Curieux N63","phone":"620006309"}', now()),
  ('a0630000-0000-0000-0000-0000000000a1', 'mamadou0063@test.gn', '{"role":"merchant","full_name":"Mamadou Diallo","phone":"+224621630001"}', now()),
  ('a0630000-0000-0000-0000-0000000000c1', 'aissatou0063@test.gn', '{"role":"client","full_name":"Aïssatou Barry","phone":"621630002"}', now()),
  ('a0630000-0000-0000-0000-0000000000c2', 'ancien0063@test.gn', '{"role":"client","full_name":"barry","phone":"621630003"}', now()),
  ('a0630000-0000-0000-0000-0000000000c3', 'ami0063@test.gn', '{"role":"client","full_name":"Ami de Mamadou","phone":"621630004"}', now());
update public.profiles set id = auth_user_id where auth_user_id::text like 'a0630000-%';
update public.profiles set created_at = now() - interval '2 days' where id = 'a0630000-0000-0000-0000-0000000000a1';
update public.profiles set created_at = now() - interval '1 day'
 where id in ('a0630000-0000-0000-0000-0000000000e1', 'a0630000-0000-0000-0000-0000000000c9', 'a0630000-0000-0000-0000-0000000000c1');
update public.profiles set created_at = now(), is_deleted = true, deleted_at = now()
 where id = 'a0630000-0000-0000-0000-0000000000c2';
update public.profiles set created_at = now() where id = 'a0630000-0000-0000-0000-0000000000c3';
insert into public.equipe (auth_user_id, nom) values ('a0630000-0000-0000-0000-0000000000e1', 'T63');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0630000-0000-0000-0000-0000000000b1', 'a0630000-0000-0000-0000-0000000000a1', 'Boutique Kaloum Électro', 1);
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0630000-0000-0000-0000-0000000000f1', 'a0630000-0000-0000-0000-0000000000b1', 1, 'Télévision Samsung', 1500000, 'draft'),
  ('a0630000-0000-0000-0000-0000000000f2', 'a0630000-0000-0000-0000-0000000000b1', 1, 'Radio Philips', 200000, 'draft');
-- Deux signalements en attente visent M (un produit, la boutique), un
-- troisième est déjà traité.
insert into public.reports (reporter_id, target_type, target_id, reason, handled_at) values
  ('a0630000-0000-0000-0000-0000000000c1', 'product',  'a0630000-0000-0000-0000-0000000000f1', 'Prix faux', null),
  ('a0630000-0000-0000-0000-0000000000c9', 'merchant', 'a0630000-0000-0000-0000-0000000000b1', 'Boutique louche', null),
  ('a0630000-0000-0000-0000-0000000000c3', 'product',  'a0630000-0000-0000-0000-0000000000f2', 'Deja vu', now());

select pg_temp.check('0063 : equipe_comptes est fermee a anon, ouverte a authenticated',
  -- Signature à trois paramètres depuis 0067 (p_role).
  not has_function_privilege('anon', 'public.equipe_comptes(text, int, text)', 'execute')
  and has_function_privilege('authenticated', 'public.equipe_comptes(text, int, text)', 'execute'));

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0063 : un non-membre ne lit pas la liste des comptes',
  pg_temp.erreur_de('select * from public.equipe_comptes()') = 'Réservé à l''équipe Filloo.');

select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0063 : recherche sans accent ni casse (AISSATOU), email lu dans auth.users',
  exists (select 1 from public.equipe_comptes('AISSATOU') x
           where x.profile_id = 'a0630000-0000-0000-0000-0000000000c1' and x.email = 'aissatou0063@test.gn'
             and x.telephone = '621630002' and x.role = 'client' and x.nom = 'Aïssatou Barry'));
select pg_temp.check('0063 : recherche avec accent (aïssatou)',
  exists (select 1 from public.equipe_comptes('aïssatou') x where x.profile_id = 'a0630000-0000-0000-0000-0000000000c1'));
select pg_temp.check('0063 : la boutique se trouve sans accent, avec ville, produits et signalements en attente',
  exists (select 1 from public.equipe_comptes('kaloum electro') x
           where x.profile_id = 'a0630000-0000-0000-0000-0000000000a1'
             and x.merchant_id = 'a0630000-0000-0000-0000-0000000000b1'
             and x.shop_name = 'Boutique Kaloum Électro' and x.ville is not null
             and x.produits = 2 and x.signalements_en_attente = 2));
select pg_temp.check('0063 : un telephone tape avec des espaces se trouve',
  exists (select 1 from public.equipe_comptes('621 63 00 01') x where x.profile_id = 'a0630000-0000-0000-0000-0000000000a1'));
select pg_temp.check('0063 : l''email se trouve, en majuscules',
  (select array_agg(x.profile_id) from public.equipe_comptes('MAMADOU0063@') x)
  = array['a0630000-0000-0000-0000-0000000000a1']::uuid[]);
select pg_temp.check('0063 : « % » est un caractere, pas un joker',
  not exists (select 1 from public.equipe_comptes('%')));
select pg_temp.check('0063 : un compte supprime vient en dernier, meme s''il correspond exactement',
  (select array_agg(x.profile_id order by x.ordinality) from public.equipe_comptes('barry') with ordinality x)
  = array['a0630000-0000-0000-0000-0000000000c1', 'a0630000-0000-0000-0000-0000000000c2']::uuid[]);
select pg_temp.check('0063 : la correspondance passe avant la date (debut du nom avant le milieu)',
  (select array_agg(x.profile_id order by x.ordinality) from public.equipe_comptes('mamadou') with ordinality x)
  = array['a0630000-0000-0000-0000-0000000000a1', 'a0630000-0000-0000-0000-0000000000c3']::uuid[]);
select pg_temp.check('0063 : sans recherche, le plus recent d''abord, et la limite est tenue',
  (select x.profile_id from public.equipe_comptes(null, 1) x) = 'a0630000-0000-0000-0000-0000000000c3'
  and (select count(*) from public.equipe_comptes(null, 2)) = 2);
select pg_temp.check('0063 : sans recherche, aucun compte supprime ne precede un compte actif',
  (with l as (select x.is_deleted, x.ordinality from public.equipe_comptes(null, 200) with ordinality x)
   select not exists (select 1 from l a join l b on a.ordinality < b.ordinality where a.is_deleted and not b.is_deleted)
          and exists (select 1 from l where l.is_deleted)));
reset role;


-- =====================================================================
-- L'équipe retrouve n'importe quel produit et lève son masquage (0064)
-- =====================================================================
-- Produits de M (0063) : f1 brouillon, f2 masqué par M lui-même, f3
-- (avec photo) masqué par l'équipe.
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0630000-0000-0000-0000-0000000000f3', 'a0630000-0000-0000-0000-0000000000b1', 1, 'Frigo LG', 900000, 'draft');
insert into public.product_images (product_id, storage_path, position) values
  ('a0630000-0000-0000-0000-0000000000f3', 'a0630000/frigo.webp', 0);
update public.products set status = 'hidden' where id = 'a0630000-0000-0000-0000-0000000000f2';

select pg_temp.check('0064 : equipe_produits et demasquer_produit sont fermees a anon, ouvertes a authenticated',
  not has_function_privilege('anon', 'public.equipe_produits(text, text, int)', 'execute')
  and not has_function_privilege('anon', 'public.demasquer_produit(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.equipe_produits(text, text, int)', 'execute')
  and has_function_privilege('authenticated', 'public.demasquer_produit(uuid, text)', 'execute'));

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.masquer_produit('a0630000-0000-0000-0000-0000000000f3', 'Photo trompeuse');

select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0064 : un non-membre ne lit pas la liste des produits',
  pg_temp.erreur_de('select * from public.equipe_produits()') = 'Réservé à l''équipe Filloo.');
select pg_temp.login('a0630000-0000-0000-0000-0000000000a1');
select pg_temp.check('0064 : le commercant ne leve pas lui-meme le masquage de l''equipe',
  pg_temp.erreur_de($q$select public.demasquer_produit('a0630000-0000-0000-0000-0000000000f3', 'Je conteste')$q$)
    = 'Réservé à l''équipe Filloo.'
  and (select masque_par_equipe from public.products where id = 'a0630000-0000-0000-0000-0000000000f3'));
select pg_temp.check('0064 : masque par l''equipe, le commercant ne le republie pas',
  pg_temp.erreur_de($q$update public.products set status = 'active' where id = 'a0630000-0000-0000-0000-0000000000f3'$q$)
    like '%masqué par l''équipe%');

select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0064 : filtre « masque_equipe » : seulement la case cochee',
  (select array_agg(x.product_id) from public.equipe_produits('kaloum', 'masque_equipe') x)
  = array['a0630000-0000-0000-0000-0000000000f3']::uuid[]);
select pg_temp.check('0064 : filtre « hidden » : le statut tel quel, masques par l''equipe compris',
  (select array_agg(x.product_id order by x.product_id) from public.equipe_produits('kaloum', 'hidden') x)
  = array['a0630000-0000-0000-0000-0000000000f2', 'a0630000-0000-0000-0000-0000000000f3']::uuid[]);
select pg_temp.check('0064 : filtre « draft »',
  (select array_agg(x.product_id) from public.equipe_produits('kaloum', 'draft') x)
  = array['a0630000-0000-0000-0000-0000000000f1']::uuid[]);
select pg_temp.check('0064 : un filtre inconnu est refuse',
  pg_temp.erreur_de($q$select * from public.equipe_produits(null, 'n_importe')$q$) = 'Filtre de produits inconnu.');
select pg_temp.check('0064 : recherche sans accent (television), colonnes rendues',
  exists (select 1 from public.equipe_produits('television') x
           where x.product_id = 'a0630000-0000-0000-0000-0000000000f1' and x.titre = 'Télévision Samsung'
             and x.statut = 'draft' and x.prix = 1500000 and x.merchant_id = 'a0630000-0000-0000-0000-0000000000b1'
             and x.shop_name = 'Boutique Kaloum Électro' and x.categorie is not null
             and not x.masque_par_equipe and x.created_at is not null));
select pg_temp.check('0064 : un uuid de produit colle le retrouve',
  (select array_agg(x.product_id) from public.equipe_produits('A0630000-0000-0000-0000-0000000000F2') x)
  = array['a0630000-0000-0000-0000-0000000000f2']::uuid[]);
select pg_temp.check('0064 : le demasquage exige un motif de 3 caracteres',
  pg_temp.erreur_de($q$select public.demasquer_produit('a0630000-0000-0000-0000-0000000000f3', ' ab ')$q$)
    = 'Le motif fait de 3 à 500 caractères.');
select pg_temp.check('0064 : produit inconnu',
  pg_temp.erreur_de($q$select public.demasquer_produit('a0630000-0000-0000-0000-00000000ffff', 'Motif')$q$)
    = 'Produit introuvable.');
select public.demasquer_produit('a0630000-0000-0000-0000-0000000000f3', 'Photo corrigee');
select public.demasquer_produit('a0630000-0000-0000-0000-0000000000f3', 'Deuxieme essai');
reset role;
select pg_temp.check('0064 : demasque = case decochee, produit toujours « hidden »',
  (select not masque_par_equipe and status = 'hidden' from public.products where id = 'a0630000-0000-0000-0000-0000000000f3'));
select pg_temp.check('0064 : le demasquage est signe une seule fois au journal (le second appel ne fait rien)',
  (select count(*) = 1 and bool_and(auteur = 'a0630000-0000-0000-0000-0000000000e1' and auteur_nom = 'T63'
                                    and cible_type = 'produit' and motif = 'Photo corrigee')
     from public.journal_equipe
    where action = 'demasquer_produit' and cible_id = 'a0630000-0000-0000-0000-0000000000f3'));
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000a1');
update public.products set status = 'active' where id = 'a0630000-0000-0000-0000-0000000000f3';
reset role;
select pg_temp.check('0064 : demasque, le commercant le republie par son geste habituel',
  (select status = 'active' from public.products where id = 'a0630000-0000-0000-0000-0000000000f3'));


-- =====================================================================
-- L'équipe fait entrer et sortir ses membres (0065)
-- =====================================================================
-- T (0063) est de l'équipe. U : connexion confirmée. V : email non
-- confirmé. W : connexion supprimée. N (0063) : client hors équipe.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, deleted_at) values
  ('a0650000-0000-0000-0000-0000000000e2', 'u0065@test.gn', '{"role":"client","full_name":"Ursule U65","phone":"620006501"}', now(), null),
  ('a0650000-0000-0000-0000-0000000000c1', 'v0065@test.gn', '{"role":"client","full_name":"Victor V65","phone":"620006502"}', null, null),
  ('a0650000-0000-0000-0000-0000000000c2', 'w0065@test.gn', '{"role":"client","full_name":"Wanda W65","phone":"620006503"}', now(), now());
-- Depuis 0067, seul le propriétaire ajoute ou retire : T l'est (posé ici,
-- comme au tableau de bord ; la migration ne trouve aucune équipe à son
-- passage dans une base de test).
update public.equipe set proprietaire = true where auth_user_id = 'a0630000-0000-0000-0000-0000000000e1';

select pg_temp.check('0065 : les trois fonctions sont fermees a anon, ouvertes a authenticated',
  not has_function_privilege('anon', 'public.equipe_membres()', 'execute')
  and not has_function_privilege('anon', 'public.ajouter_membre(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.retirer_membre(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.equipe_membres()', 'execute')
  and has_function_privilege('authenticated', 'public.ajouter_membre(text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.retirer_membre(uuid)', 'execute'));
select pg_temp.check('0065 : aucun ecran n''ecrit equipe en direct (droits retires), la lecture reste',
  not has_table_privilege('anon', 'public.equipe', 'insert')
  and not has_table_privilege('anon', 'public.equipe', 'update')
  and not has_table_privilege('anon', 'public.equipe', 'delete')
  and not has_table_privilege('anon', 'public.equipe', 'truncate')
  and not has_table_privilege('authenticated', 'public.equipe', 'insert')
  and not has_table_privilege('authenticated', 'public.equipe', 'update')
  and not has_table_privilege('authenticated', 'public.equipe', 'delete')
  and not has_table_privilege('authenticated', 'public.equipe', 'truncate')
  and has_table_privilege('authenticated', 'public.equipe', 'select'));

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0065 : un non-membre ne lit pas l''equipe, ne s''y ajoute pas, n''en retire personne',
  pg_temp.erreur_de('select * from public.equipe_membres()') = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de($q$select public.ajouter_membre('n0063@test.gn', 'Moi')$q$) = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de($q$select public.retirer_membre('a0630000-0000-0000-0000-0000000000e1')$q$) = 'Réservé à l''équipe Filloo.');
reset role;
select pg_temp.check('0065 : le non-membre n''est toujours pas de l''equipe',
  not exists (select 1 from public.equipe where auth_user_id = 'a0630000-0000-0000-0000-0000000000c9'));

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0065 : email non confirme, connexion supprimee, adresse inconnue : refus explicite',
  pg_temp.erreur_de($q$select public.ajouter_membre('v0065@test.gn', 'V')$q$)
    = 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire sur Filloo.'
  and pg_temp.erreur_de($q$select public.ajouter_membre('w0065@test.gn', 'W')$q$)
    = 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire sur Filloo.'
  and pg_temp.erreur_de($q$select public.ajouter_membre('personne0065@test.gn', 'X')$q$)
    = 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire sur Filloo.');
select pg_temp.check('0065 : un prenom vide est refuse',
  pg_temp.erreur_de($q$select public.ajouter_membre('u0065@test.gn', '  ')$q$)
    = 'Le prénom affiché aux collègues fait de 1 à 60 caractères.');
select public.ajouter_membre('  U0065@Test.GN ', ' Ursule ');
select pg_temp.check('0065 : un membre deja la est refuse',
  pg_temp.erreur_de($q$select public.ajouter_membre('u0065@test.gn', 'Ursule')$q$)
    = 'Cette personne fait déjà partie de l''équipe.');
select pg_temp.check('0065 : equipe_membres rend l''email et « moi » pour l''appelant seul',
  exists (select 1 from public.equipe_membres() x
           where x.auth_user_id = 'a0650000-0000-0000-0000-0000000000e2' and x.nom = 'Ursule'
             and x.email = 'u0065@test.gn' and not x.moi and x.created_at is not null)
  and (select array_agg(x.auth_user_id) from public.equipe_membres() x where x.moi)
      = array['a0630000-0000-0000-0000-0000000000e1']::uuid[]);
reset role;
select pg_temp.check('0065 : ajoute = dans equipe ET marque app_metadata.equipe (0043)',
  exists (select 1 from public.equipe where auth_user_id = 'a0650000-0000-0000-0000-0000000000e2' and nom = 'Ursule')
  and (select raw_app_meta_data -> 'equipe' = 'true'::jsonb from auth.users where id = 'a0650000-0000-0000-0000-0000000000e2'));
select pg_temp.check('0065 : l''ajout est signe au journal',
  (select count(*) = 1 from public.journal_equipe
    where action = 'ajouter_membre' and cible_type = 'membre' and cible_id = 'a0650000-0000-0000-0000-0000000000e2'
      and auteur = 'a0630000-0000-0000-0000-0000000000e1' and motif = 'Ursule <u0065@test.gn>'));

-- U agit en membre : une ligne de journal et un message au fil.
set role authenticated;
select pg_temp.login('a0650000-0000-0000-0000-0000000000e2');
select public.masquer_produit('a0630000-0000-0000-0000-0000000000f1', 'Masque par U');
reset role;
insert into public.fil_equipe (id, fil_de, espace, auteur_id, de_l_equipe, corps) values
  ('a0650000-0000-0000-0000-0000000000d1', 'a0630000-0000-0000-0000-0000000000c1', 'client',
   'a0650000-0000-0000-0000-0000000000e2', true, 'Bonjour de la part de U');

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0065 : on ne se retire pas soi-meme',
  pg_temp.erreur_de($q$select public.retirer_membre('a0630000-0000-0000-0000-0000000000e1')$q$)
    = 'Vous ne pouvez pas vous retirer vous-même de l''équipe.');
select pg_temp.check('0065 : on ne retire pas quelqu''un qui n''est pas de l''equipe',
  pg_temp.erreur_de($q$select public.retirer_membre('a0630000-0000-0000-0000-0000000000c9')$q$)
    = 'Ce compte ne fait pas partie de l''équipe.');
select public.retirer_membre('a0650000-0000-0000-0000-0000000000e2');
reset role;
select pg_temp.check('0065 : retire = hors d''equipe ET marque retiree',
  not exists (select 1 from public.equipe where auth_user_id = 'a0650000-0000-0000-0000-0000000000e2')
  and (select not (coalesce(raw_app_meta_data, '{}') ? 'equipe') from auth.users where id = 'a0650000-0000-0000-0000-0000000000e2'));
select pg_temp.check('0065 : le retrait est signe au journal',
  (select count(*) = 1 from public.journal_equipe
    where action = 'retirer_membre' and cible_type = 'membre' and cible_id = 'a0650000-0000-0000-0000-0000000000e2'
      and auteur = 'a0630000-0000-0000-0000-0000000000e1' and motif = 'Ursule <u0065@test.gn>'));
select pg_temp.check('0065 : le membre retire garde son nom au journal et son message au fil',
  (select auteur is null and auteur_nom = 'Ursule' from public.journal_equipe
    where action = 'masquer_produit' and cible_id = 'a0630000-0000-0000-0000-0000000000f1')
  and (select auteur_id = 'a0650000-0000-0000-0000-0000000000e2' from public.fil_equipe
        where id = 'a0650000-0000-0000-0000-0000000000d1'));
set role authenticated;
select pg_temp.login('a0650000-0000-0000-0000-0000000000e2');
select pg_temp.check('0065 : retire, il est refuse aussitot (la base lit equipe, pas le jeton)',
  not public.je_suis_de_l_equipe()
  and pg_temp.erreur_de('select * from public.equipe_comptes()') = 'Réservé à l''équipe Filloo.');
reset role;


-- =====================================================================
-- L'équipe tient les catégories et les villes (0066)
-- =====================================================================
select pg_temp.check('0066 : les quatre fonctions sont fermees a anon, ouvertes a authenticated',
  not has_function_privilege('anon', 'public.fixer_categorie(int, text, int)', 'execute')
  and not has_function_privilege('anon', 'public.retirer_categorie(int)', 'execute')
  and not has_function_privilege('anon', 'public.fixer_ville(int, text, int)', 'execute')
  and not has_function_privilege('anon', 'public.retirer_ville(int)', 'execute')
  and has_function_privilege('authenticated', 'public.fixer_categorie(int, text, int)', 'execute')
  and has_function_privilege('authenticated', 'public.retirer_categorie(int)', 'execute')
  and has_function_privilege('authenticated', 'public.fixer_ville(int, text, int)', 'execute')
  and has_function_privilege('authenticated', 'public.retirer_ville(int)', 'execute'));
select pg_temp.check('0066 : les outils internes ne sont pas exposes',
  not has_function_privilege('anon', 'public.cible_journal_entier(int)', 'execute')
  and not has_function_privilege('authenticated', 'public.cible_journal_entier(int)', 'execute')
  and not has_function_privilege('anon', 'public.nom_compare(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.nom_compare(text)', 'execute'));
select pg_temp.check('0066 : catégories et villes restent en lecture seule pour tout ecran (truncate compris)',
  not has_table_privilege('anon', 'public.categories', 'insert')
  and not has_table_privilege('anon', 'public.categories', 'update')
  and not has_table_privilege('anon', 'public.categories', 'delete')
  and not has_table_privilege('anon', 'public.categories', 'truncate')
  and not has_table_privilege('authenticated', 'public.categories', 'insert')
  and not has_table_privilege('authenticated', 'public.categories', 'update')
  and not has_table_privilege('authenticated', 'public.categories', 'delete')
  and not has_table_privilege('authenticated', 'public.categories', 'truncate')
  and not has_table_privilege('anon', 'public.cities', 'insert')
  and not has_table_privilege('anon', 'public.cities', 'update')
  and not has_table_privilege('anon', 'public.cities', 'delete')
  and not has_table_privilege('anon', 'public.cities', 'truncate')
  and not has_table_privilege('authenticated', 'public.cities', 'insert')
  and not has_table_privilege('authenticated', 'public.cities', 'update')
  and not has_table_privilege('authenticated', 'public.cities', 'delete')
  and not has_table_privilege('authenticated', 'public.cities', 'truncate'));
set role anon;
select pg_temp.check('0066 : un visiteur lit toujours categories(id, name) et cities(id, name) (l''app installee)',
  (select count(*) from (select id, name, slug, position from public.categories order by position) c) > 0
  and (select count(*) from (select id, name, position from public.cities order by position) v) > 0);
reset role;

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0066 : un non-membre ne cree, ne modifie ni ne retire rien',
  pg_temp.erreur_de($q$select public.fixer_categorie(p_nom => 'Pirate')$q$) = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de($q$select public.fixer_categorie(1, 'Pirate', 1)$q$) = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de('select public.retirer_categorie(1)') = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de($q$select public.fixer_ville(p_nom => 'Pirate')$q$) = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de('select public.retirer_ville(1)') = 'Réservé à l''équipe Filloo.'
  and pg_temp.refuse($q$insert into public.categories (slug, name) values ('pirate', 'Pirate')$q$)
  and pg_temp.refuse($q$update public.cities set name = 'Pirate' where id = 1$q$));
reset role;
select pg_temp.check('0066 : rien n''a change sous le non-membre',
  not exists (select 1 from public.categories where name = 'Pirate')
  and not exists (select 1 from public.cities where name = 'Pirate'));

-- Création sans p_id, comme le site (`p_id: id ?? undefined`).
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.fixer_categorie(p_nom => '  Électroménager &   Cuisine ', p_position => null) as cat66 \gset
select public.fixer_categorie(p_nom => 'Électroménager / Cuisine', p_position => 50) as cat66b \gset
reset role;
select pg_temp.check('0066 : creation : slug sans accents, nom nettoye, en fin de liste',
  (select slug = 'electromenager-cuisine' and name = 'Électroménager & Cuisine'
          and position = (select max(c2.position) from public.categories c2 where c2.id not in (:cat66, :cat66b)) + 1
     from public.categories where id = :cat66));
select pg_temp.check('0066 : un slug deja pris recoit un suffixe',
  (select slug = 'electromenager-cuisine-2' and position = 50 from public.categories where id = :cat66b));

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0066 : un nom deja porte (casse et accents pres) est refuse',
  pg_temp.erreur_de($q$select public.fixer_categorie(p_nom => 'electromenager & CUISINE')$q$)
    = 'Une catégorie porte déjà ce nom.');
select pg_temp.check('0066 : nom de 2 a 40 caracteres, position de 0 a 9999, id inconnu',
  pg_temp.erreur_de($q$select public.fixer_categorie(p_nom => 'a')$q$) = 'Le nom fait de 2 à 40 caractères.'
  and pg_temp.erreur_de($q$select public.fixer_categorie(p_nom => repeat('x', 41))$q$) = 'Le nom fait de 2 à 40 caractères.'
  and pg_temp.erreur_de($q$select public.fixer_categorie(p_nom => 'Correct', p_position => -1)$q$) = 'La position va de 0 à 9999.'
  and pg_temp.erreur_de($q$select public.fixer_categorie(999999, 'Correct', 1)$q$) = 'Catégorie introuvable.'
  and pg_temp.erreur_de($q$select public.fixer_categorie(p_id => 1)$q$) = 'Le nom fait de 2 à 40 caractères.');
select public.fixer_categorie(:cat66, 'Cuisine & Maison', 3);
select public.fixer_categorie(:cat66, 'Cuisine & Maison', 3);
select public.fixer_categorie(p_id => :cat66, p_nom => 'Cuisine & Maison');
reset role;
select pg_temp.check('0066 : renommer et deplacer ne change JAMAIS le slug',
  (select slug = 'electromenager-cuisine' and name = 'Cuisine & Maison' and position = 3
     from public.categories where id = :cat66));
select pg_temp.check('0066 : creation et modification signees au journal, la modification sans effet n''ecrit rien',
  (select count(*) = 2 from public.journal_equipe
    where action = 'fixer_categorie' and cible_type = 'categorie'
      and cible_id = public.cible_journal_entier(:cat66))
  and exists (select 1 from public.journal_equipe
               where action = 'fixer_categorie' and cible_id = public.cible_journal_entier(:cat66)
                 and motif like 'Électroménager & Cuisine → Cuisine & Maison%'
                 and auteur = 'a0630000-0000-0000-0000-0000000000e1'));
select pg_temp.check('0066 : la cible du journal est deduite de l''id, distincte d''un id a l''autre',
  public.cible_journal_entier(10) = '00000000-0000-0000-0000-00000000000a'
  and public.cible_journal_entier(:cat66) <> public.cible_journal_entier(:cat66b));

-- Une campagne vise cat66b (0047) : aucun produit ne l'utilise.
insert into public.campagnes (id, merchant_id, type, product_id, category_id, duree_jours) values
  ('a0660000-0000-0000-0000-0000000000a1', 'a0630000-0000-0000-0000-0000000000b1', 'categorie',
   'a0630000-0000-0000-0000-0000000000f2', :cat66b, 7);
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0066 : une categorie utilisee par des produits ne se retire pas (le message dit combien)',
  pg_temp.erreur_de('select public.retirer_categorie(1)') ~ '^Impossible de retirer « .* » : [1-9][0-9]* produit\(s\)');
select pg_temp.check('0066 : une categorie visee par une campagne ne se retire pas',
  pg_temp.erreur_de('select public.retirer_categorie(' || :cat66b || ')')
    = 'Impossible de retirer « Électroménager / Cuisine » : 1 campagne(s) de publicité la visent.');
select pg_temp.check('0066 : retirer une categorie inconnue',
  pg_temp.erreur_de('select public.retirer_categorie(999999)') = 'Catégorie introuvable.');
select public.retirer_categorie(:cat66);
reset role;
select pg_temp.check('0066 : une categorie libre se retire, signee au journal',
  not exists (select 1 from public.categories where id = :cat66)
  and exists (select 1 from public.categories where id = :cat66b)
  and exists (select 1 from public.journal_equipe
               where action = 'retirer_categorie' and cible_type = 'categorie'
                 and cible_id = public.cible_journal_entier(:cat66) and motif = 'Cuisine & Maison (electromenager-cuisine)'));
delete from public.campagnes where id = 'a0660000-0000-0000-0000-0000000000a1';

-- Les villes.
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.fixer_ville(p_nom => 'Fria') as v66 \gset
select pg_temp.check('0066 : une ville deja portee (casse et accents pres) est refusee',
  pg_temp.erreur_de($q$select public.fixer_ville(p_nom => 'CONAKRY')$q$) = 'Une ville porte déjà ce nom.'
  and pg_temp.erreur_de($q$select public.fixer_ville(p_nom => 'Nzerekore')$q$) = 'Une ville porte déjà ce nom.');
select pg_temp.check('0066 : ville : nom borne, id inconnu',
  pg_temp.erreur_de($q$select public.fixer_ville(p_nom => 'F')$q$) = 'Le nom fait de 2 à 40 caractères.'
  and pg_temp.erreur_de($q$select public.fixer_ville(999999, 'Correct', 1)$q$) = 'Ville introuvable.'
  and pg_temp.erreur_de('select public.retirer_ville(999999)') = 'Ville introuvable.');
select public.fixer_ville(:v66, 'Fria Centre', 20);
select pg_temp.check('0066 : une ville qui porte des boutiques ne se retire pas',
  pg_temp.erreur_de('select public.retirer_ville(1)') ~ '^Impossible de retirer « .* » : [1-9][0-9]* boutique\(s\)');
reset role;
select pg_temp.check('0066 : la ville est creee en fin de liste, puis renommee et deplacee',
  (select name = 'Fria Centre' and position = 20 from public.cities where id = :v66)
  and (select count(*) = 2 from public.journal_equipe
        where action = 'fixer_ville' and cible_type = 'ville' and cible_id = public.cible_journal_entier(:v66)));
update public.profiles set city_id = :v66 where id = 'a0630000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0066 : une ville qu''un seul profil utilise ne se retire pas non plus',
  pg_temp.erreur_de('select public.retirer_ville(' || :v66 || ')')
    = 'Impossible de retirer « Fria Centre » : 0 boutique(s) et 1 profil(s) l''utilisent.');
reset role;
update public.profiles set city_id = null where id = 'a0630000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.retirer_ville(:v66);
reset role;
select pg_temp.check('0066 : une ville libre se retire, signee au journal',
  not exists (select 1 from public.cities where id = :v66)
  and exists (select 1 from public.journal_equipe
               where action = 'retirer_ville' and cible_type = 'ville'
                 and cible_id = public.cible_journal_entier(:v66) and motif = 'Fria Centre'));


-- =====================================================================
-- Le propriétaire tient l'équipe ; fiche, suppressions, ordre (0067)
-- =====================================================================
-- T (0063) est le propriétaire (posé en 0065 de ce fichier). Y : membre
-- ordinaire, ajouté par T. N (0063) : client hors équipe. M (0063) :
-- boutique b1. C1, C3 : clients ; C2 : compte supprimé (0063).
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, last_sign_in_at) values
  ('a0670000-0000-0000-0000-0000000000e3', 'y0067@test.gn', '{"role":"client","full_name":"Yacine Y67","phone":"620006701"}', now(), null),
  ('a0670000-0000-0000-0000-0000000000e4', 'z0067@test.gn', '{"role":"client","full_name":"Zalika Z67","phone":"620006702"}', now(), null);
update auth.users set last_sign_in_at = '2026-11-06 10:00+00'
 where id = 'a0630000-0000-0000-0000-0000000000a1';

select pg_temp.check('0067 : les nouvelles fonctions sont fermees a anon, ouvertes a authenticated',
  not has_function_privilege('anon', 'public.je_suis_proprietaire()', 'execute')
  and not has_function_privilege('anon', 'public.equipe_compte(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.equipe_produits_boutique(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.supprimer_produit_equipe(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.journaliser_suppression_compte(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.equipe_membres()', 'execute')
  and has_function_privilege('authenticated', 'public.je_suis_proprietaire()', 'execute')
  and has_function_privilege('authenticated', 'public.equipe_compte(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.equipe_produits_boutique(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.supprimer_produit_equipe(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.journaliser_suppression_compte(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.equipe_membres()', 'execute'));
select pg_temp.check('0067 : les outils internes ne sont exposes a personne',
  not has_function_privilege('anon', 'public.poser_premier_proprietaire()', 'execute')
  and not has_function_privilege('authenticated', 'public.poser_premier_proprietaire()', 'execute')
  and not has_function_privilege('authenticated', 'public.renumeroter_categories()', 'execute')
  and not has_function_privilege('authenticated', 'public.renumeroter_villes()', 'execute')
  and not has_function_privilege('anon', 'public.renumeroter_villes()', 'execute'));
select pg_temp.check('0067 : l''ancienne equipe_comptes(text, int) n''existe plus (pas de doublon pour PostgREST)',
  to_regprocedure('public.equipe_comptes(text, int)') is null
  and to_regprocedure('public.equipe_comptes(text, int, text)') is not null);

-- --- Le propriétaire --------------------------------------------------
select pg_temp.check('0067 : aucun ecran n''ecrit la colonne proprietaire',
  not has_column_privilege('authenticated', 'public.equipe', 'proprietaire', 'update')
  and not has_column_privilege('authenticated', 'public.equipe', 'proprietaire', 'insert')
  and not has_column_privilege('anon', 'public.equipe', 'proprietaire', 'update')
  and not has_column_privilege('anon', 'public.equipe', 'proprietaire', 'insert'));
select pg_temp.check('0067 : un seul proprietaire (index unique partiel)',
  pg_temp.erreur_de($q$update public.equipe set proprietaire = true where auth_user_id <> 'a0630000-0000-0000-0000-0000000000e1'$q$)
    like '%equipe_un_seul_proprietaire%'
  and (select count(*) = 1 from public.equipe where proprietaire));

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0067 : meme le proprietaire ne change pas proprietaire en direct',
  pg_temp.refuse($q$update public.equipe set proprietaire = false where auth_user_id = 'a0630000-0000-0000-0000-0000000000e1'$q$)
  and public.je_suis_proprietaire());
select public.ajouter_membre('y0067@test.gn', 'Yacine');
select pg_temp.check('0067 : equipe_membres dit qui est proprietaire (T seul), le nouveau membre ne l''est pas',
  (select array_agg(x.auth_user_id) from public.equipe_membres() x where x.proprietaire)
    = array['a0630000-0000-0000-0000-0000000000e1']::uuid[]
  and exists (select 1 from public.equipe_membres() x
               where x.auth_user_id = 'a0670000-0000-0000-0000-0000000000e3' and not x.proprietaire and not x.moi));

select pg_temp.login('a0670000-0000-0000-0000-0000000000e3');
select pg_temp.check('0067 : un membre ordinaire n''est pas proprietaire',
  public.je_suis_de_l_equipe() and not public.je_suis_proprietaire());
select pg_temp.check('0067 : un membre ordinaire n''ajoute personne',
  pg_temp.erreur_de($q$select public.ajouter_membre('z0067@test.gn', 'Zalika')$q$) = 'Réservé au propriétaire de Filloo.');
select pg_temp.check('0067 : un membre ordinaire ne retire personne (ni un collegue, ni le proprietaire)',
  pg_temp.erreur_de($q$select public.retirer_membre('a0630000-0000-0000-0000-0000000000e1')$q$) = 'Réservé au propriétaire de Filloo.');
select pg_temp.check('0067 : un membre ordinaire lit toujours l''equipe',
  (select count(*) >= 2 from public.equipe_membres()));
select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0067 : un non-membre recoit toujours le refus de l''equipe (il n''apprend rien)',
  pg_temp.erreur_de($q$select public.ajouter_membre('z0067@test.gn', 'Zalika')$q$) = 'Réservé à l''équipe Filloo.'
  and not public.je_suis_proprietaire());
reset role;
select pg_temp.check('0067 : les refus n''ont rien change (Z dehors, T dedans, aucun journal de Y)',
  not exists (select 1 from public.equipe where auth_user_id = 'a0670000-0000-0000-0000-0000000000e4')
  and exists (select 1 from public.equipe where auth_user_id = 'a0630000-0000-0000-0000-0000000000e1')
  and not exists (select 1 from public.journal_equipe where auteur = 'a0670000-0000-0000-0000-0000000000e3'));

-- Garde explicite « le propriétaire ne se retire pas » : inatteignable
-- avec un seul propriétaire (on ne se retire pas soi-même) ; prouvée en
-- levant l'unicité le temps d'une transaction annulée.
begin;
drop index public.equipe_un_seul_proprietaire;
update public.equipe set proprietaire = true where auth_user_id = 'a0670000-0000-0000-0000-0000000000e3';
set local role authenticated;
select pg_temp.login('a0670000-0000-0000-0000-0000000000e3');
select pg_temp.check('0067 : le proprietaire ne se retire pas de l''equipe, meme par un autre proprietaire',
  pg_temp.erreur_de($q$select public.retirer_membre('a0630000-0000-0000-0000-0000000000e1')$q$)
    = 'Le propriétaire de Filloo ne se retire pas de l''équipe.');
rollback;

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.retirer_membre('a0670000-0000-0000-0000-0000000000e3');
reset role;
select pg_temp.check('0067 : le proprietaire retire un membre, signe au journal',
  not exists (select 1 from public.equipe where auth_user_id = 'a0670000-0000-0000-0000-0000000000e3')
  and exists (select 1 from public.journal_equipe
               where action = 'retirer_membre' and cible_id = 'a0670000-0000-0000-0000-0000000000e3'
                 and auteur = 'a0630000-0000-0000-0000-0000000000e1'));

-- La désignation du premier propriétaire (celle que la migration a faite),
-- rejouée dans des transactions annulées.
begin;
insert into public.equipe (auth_user_id, nom) values ('a0670000-0000-0000-0000-0000000000e4', 'Zalika');
update public.equipe set proprietaire = false;
update public.equipe set created_at = '2030-01-01';
update public.equipe set created_at = '2020-01-01' where auth_user_id = 'a0670000-0000-0000-0000-0000000000e4';
select public.poser_premier_proprietaire();
select pg_temp.check('0067 : le plus ancien membre devient proprietaire, lui seul',
  (select array_agg(e.auth_user_id) from public.equipe e where e.proprietaire)
    = array['a0670000-0000-0000-0000-0000000000e4']::uuid[]);
rollback;
begin;
update public.equipe set proprietaire = false;
update public.equipe set created_at = '2020-01-01';
select pg_temp.check('0067 : deux membres a egalite pour le plus ancien : la designation s''arrete',
  pg_temp.erreur_de('select public.poser_premier_proprietaire()') like '%propriétaire ambigu%'
  and not exists (select 1 from public.equipe where proprietaire));
rollback;
begin;
update public.equipe set created_at = '2030-01-01' where auth_user_id = 'a0630000-0000-0000-0000-0000000000e1';
select public.poser_premier_proprietaire();
select pg_temp.check('0067 : un proprietaire deja en place ne change pas',
  (select array_agg(e.auth_user_id) from public.equipe e where e.proprietaire)
    = array['a0630000-0000-0000-0000-0000000000e1']::uuid[]);
rollback;

-- --- Acheteurs et vendeurs --------------------------------------------
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0067 : p_role merchant : les vendeurs seuls',
  (select array_agg(x.profile_id) from public.equipe_comptes('mamadou', 50, 'merchant') x)
    = array['a0630000-0000-0000-0000-0000000000a1']::uuid[]
  and not exists (select 1 from public.equipe_comptes(null, 200, 'merchant') x where x.role <> 'merchant'));
select pg_temp.check('0067 : p_role client : les acheteurs seuls',
  (select array_agg(x.profile_id) from public.equipe_comptes('mamadou', 50, 'client') x)
    = array['a0630000-0000-0000-0000-0000000000c3']::uuid[]
  and not exists (select 1 from public.equipe_comptes(null, 200, 'client') x where x.role <> 'client'));
select pg_temp.check('0067 : l''appel a deux parametres (site en production) rend toujours tout',
  (select count(*) from public.equipe_comptes('mamadou', 50)) = 2
  and (select count(*) from public.equipe_comptes(p_recherche => 'mamadou')) = 2);
select pg_temp.check('0067 : equipe_comptes rend la connexion (auth_user_id) en derniere colonne',
  (select x.auth_user_id from public.equipe_comptes('mamadou0063@', 50, 'merchant') x)
    = 'a0630000-0000-0000-0000-0000000000a1'
  and (select (proargnames)[array_length(proargnames, 1)] = 'auth_user_id'
         from pg_proc where oid = 'public.equipe_comptes(text, int, text)'::regprocedure));
select pg_temp.check('0067 : un role inconnu est refuse',
  pg_temp.erreur_de($q$select * from public.equipe_comptes(null, 50, 'admin')$q$) = 'Filtre de comptes inconnu.');
select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0067 : un non-membre ne lit ni les listes ni une fiche ni les produits d''une boutique',
  pg_temp.erreur_de($q$select * from public.equipe_comptes(null, 50, 'client')$q$) = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de($q$select * from public.equipe_compte('a0630000-0000-0000-0000-0000000000a1')$q$) = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de($q$select * from public.equipe_produits_boutique('a0630000-0000-0000-0000-0000000000b1')$q$) = 'Réservé à l''équipe Filloo.');
select pg_temp.login('a0630000-0000-0000-0000-0000000000a1');
select pg_temp.check('0067 : le commercant ne lit pas sa propre fiche d''equipe',
  pg_temp.erreur_de($q$select * from public.equipe_compte('a0630000-0000-0000-0000-0000000000a1')$q$) = 'Réservé à l''équipe Filloo.');
reset role;

-- --- La fiche ---------------------------------------------------------
insert into public.conversations (id, client_id, merchant_id) values
  ('a0670000-0000-0000-0000-0000000000d1', 'a0630000-0000-0000-0000-0000000000c1', 'a0630000-0000-0000-0000-0000000000b1');
update public.merchants set description = 'Electro a Kaloum', whatsapp_phone = '620006799', address_hint = 'Marche Niger'
 where id = 'a0630000-0000-0000-0000-0000000000b1';

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0067 : fiche d''une boutique : connexion, boutique, compteurs',
  exists (select 1 from public.equipe_compte('a0630000-0000-0000-0000-0000000000a1') x
           where x.profile_id = 'a0630000-0000-0000-0000-0000000000a1'
             and x.auth_user_id = 'a0630000-0000-0000-0000-0000000000a1'
             and x.role = 'merchant' and x.nom = 'Mamadou Diallo' and x.telephone = '+224621630001'
             and x.email = 'mamadou0063@test.gn' and x.email_confirme_le is not null
             and x.derniere_connexion = '2026-11-06 10:00+00' and x.ville is not null
             and x.created_at is not null and not x.is_suspended and x.suspension_reason is null
             and not x.is_deleted and x.deleted_at is null
             and x.merchant_id = 'a0630000-0000-0000-0000-0000000000b1'
             and x.shop_name = 'Boutique Kaloum Électro' and x.description = 'Electro a Kaloum'
             and x.whatsapp_phone = '620006799' and x.address_hint = 'Marche Niger'
             and x.photo_path is null and x.statut_boutique = 'approved' and x.approved_at is not null
             and x.rejection_reason is null
             and x.produits = 3  -- f1, f2, f3 (0063, 0064), tous statuts
             and x.conversations = 1 and x.signalements_en_attente = 2 and not x.est_de_l_equipe));
select pg_temp.check('0067 : fiche d''un client : pas de boutique, ses conversations comptees',
  exists (select 1 from public.equipe_compte('a0630000-0000-0000-0000-0000000000c1') x
           where x.role = 'client' and x.merchant_id is null and x.shop_name is null
             and x.produits = 0 and x.conversations = 1 and not x.est_de_l_equipe));
-- Depuis 0076, un membre n'a plus de profil : son ancien profil est remis
-- un instant, déclencheur levé, pour prouver que la fiche le signale
-- encore (le site s'en sert avant une suppression).
reset role;
begin;
alter table public.profiles disable trigger profil_hors_equipe;
insert into public.profiles (id, auth_user_id, role, full_name, phone)
  values ('a0630000-0000-0000-0000-0000000000e1', 'a0630000-0000-0000-0000-0000000000e1', 'client', 'Equipier T63', '620006301')
  on conflict (id) do nothing;
alter table public.profiles enable trigger profil_hors_equipe;
set role authenticated;
select pg_temp.check('0067 : fiche d''un membre de l''equipe : est_de_l_equipe',
  (select x.est_de_l_equipe from public.equipe_compte('a0630000-0000-0000-0000-0000000000e1') x));
reset role;
rollback;
set role authenticated;
select pg_temp.check('0067 : fiche d''un compte supprime, et d''un profil inconnu (aucune ligne)',
  (select x.is_deleted and x.deleted_at is not null from public.equipe_compte('a0630000-0000-0000-0000-0000000000c2') x)
  and not exists (select 1 from public.equipe_compte('a0670000-0000-0000-0000-00000000ffff')));
reset role;

-- --- Les produits d'une boutique --------------------------------------
-- f2 reçoit deux photos, la position 1 insérée AVANT la position 0 : la
-- première photo est celle de plus petite position, pas la première écrite.
insert into public.product_images (product_id, storage_path, position) values
  ('a0630000-0000-0000-0000-0000000000f2', 'a0630000/radio-dos.webp', 1);
insert into public.product_images (product_id, storage_path, position) values
  ('a0630000-0000-0000-0000-0000000000f2', 'a0630000/radio-face.webp', 0);

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0067 : tous les produits de la boutique, tous statuts (brouillon, masque, en ligne), d''elle seule',
  (select array_agg(x.product_id order by x.product_id) from public.equipe_produits_boutique('a0630000-0000-0000-0000-0000000000b1') x)
    = array['a0630000-0000-0000-0000-0000000000f1', 'a0630000-0000-0000-0000-0000000000f2',
            'a0630000-0000-0000-0000-0000000000f3']::uuid[]
  and (select count(distinct x.statut) >= 2 from public.equipe_produits_boutique('a0630000-0000-0000-0000-0000000000b1') x));
select pg_temp.check('0067 : la premiere photo est celle de plus petite position',
  (select x.photo_path from public.equipe_produits_boutique('a0630000-0000-0000-0000-0000000000b1') x
    where x.product_id = 'a0630000-0000-0000-0000-0000000000f2') = 'a0630000/radio-face.webp');
select pg_temp.check('0067 : colonnes d''un produit, photo absente = null',
  exists (select 1 from public.equipe_produits_boutique('a0630000-0000-0000-0000-0000000000b1') x
           where x.product_id = 'a0630000-0000-0000-0000-0000000000f1' and x.titre = 'Télévision Samsung'
             and x.prix = 1500000 and x.categorie is not null and x.masque_par_equipe
             and x.statut = 'hidden' and x.created_at is not null and x.photo_path is null));
select pg_temp.check('0067 : une boutique inconnue ne rend rien',
  not exists (select 1 from public.equipe_produits_boutique('a0670000-0000-0000-0000-00000000ffff')));
reset role;

-- --- Supprimer un produit ---------------------------------------------
-- f9 : en ligne, une photo, une campagne, cité par un message.
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0670000-0000-0000-0000-0000000000f9', 'a0630000-0000-0000-0000-0000000000b1', 1, 'Ventilateur Binatone', 300000, 'draft');
insert into public.product_images (product_id, storage_path, position) values
  ('a0670000-0000-0000-0000-0000000000f9', 'a0630000-0000-0000-0000-0000000000b1/a0670000-0000-0000-0000-0000000000f9/1.webp', 0);
update public.products set status = 'active' where id = 'a0670000-0000-0000-0000-0000000000f9';
insert into public.campagnes (id, merchant_id, type, product_id, duree_jours) values
  ('a0670000-0000-0000-0000-0000000000a9', 'a0630000-0000-0000-0000-0000000000b1', 'produit',
   'a0670000-0000-0000-0000-0000000000f9', 7);
insert into public.messages (id, conversation_id, sender_id, product_id, body) values
  ('a0670000-0000-0000-0000-0000000000b9', 'a0670000-0000-0000-0000-0000000000d1',
   'a0630000-0000-0000-0000-0000000000c1', 'a0670000-0000-0000-0000-0000000000f9', 'Le ventilateur est dispo ?');

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0067 : un non-membre ne supprime pas un produit',
  pg_temp.erreur_de($q$select public.supprimer_produit_equipe('a0670000-0000-0000-0000-0000000000f9', 'Je veux')$q$)
    = 'Réservé à l''équipe Filloo.');
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0067 : suppression : motif de 3 a 500 caracteres, produit inconnu',
  pg_temp.erreur_de($q$select public.supprimer_produit_equipe('a0670000-0000-0000-0000-0000000000f9', ' ab ')$q$)
    = 'Le motif fait de 3 à 500 caractères.'
  and pg_temp.erreur_de($q$select public.supprimer_produit_equipe('a0670000-0000-0000-0000-0000000000f9', repeat('x', 501))$q$)
    = 'Le motif fait de 3 à 500 caractères.'
  and pg_temp.erreur_de($q$select public.supprimer_produit_equipe('a0670000-0000-0000-0000-00000000ffff', 'Motif')$q$)
    = 'Produit introuvable.');
reset role;
select pg_temp.check('0067 : les refus n''ont rien supprime',
  exists (select 1 from public.products where id = 'a0670000-0000-0000-0000-0000000000f9')
  and not exists (select 1 from public.journal_equipe where action = 'supprimer_produit'));

set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.supprimer_produit_equipe('a0670000-0000-0000-0000-0000000000f9', 'Contrefacon') as m67 \gset
reset role;
select pg_temp.check('0067 : la suppression rend le merchant_id (le site efface le dossier des photos)',
  :'m67' = 'a0630000-0000-0000-0000-0000000000b1');
select pg_temp.check('0067 : produit, photos et campagne partis ; le message reste, sans produit',
  not exists (select 1 from public.products where id = 'a0670000-0000-0000-0000-0000000000f9')
  and not exists (select 1 from public.product_images where product_id = 'a0670000-0000-0000-0000-0000000000f9')
  and not exists (select 1 from public.campagnes where id = 'a0670000-0000-0000-0000-0000000000a9')
  and (select product_id is null and body = 'Le ventilateur est dispo ?' from public.messages
        where id = 'a0670000-0000-0000-0000-0000000000b9'));
select pg_temp.check('0067 : la suppression est signee au journal, titre et boutique en clair',
  (select count(*) = 1 and bool_and(auteur = 'a0630000-0000-0000-0000-0000000000e1' and cible_type = 'produit'
                                    and motif = '« Ventilateur Binatone » (Boutique Kaloum Électro) : Contrefacon')
     from public.journal_equipe
    where action = 'supprimer_produit' and cible_id = 'a0670000-0000-0000-0000-0000000000f9'));

-- --- Signer une suppression de compte ---------------------------------
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000c9');
select pg_temp.check('0067 : un non-membre ne signe pas une suppression',
  pg_temp.erreur_de($q$select public.journaliser_suppression_compte('a0630000-0000-0000-0000-0000000000c2', 'Motif')$q$)
    = 'Réservé à l''équipe Filloo.');
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0067 : le journal refuse un compte qui n''est PAS supprime (il ne ment pas)',
  pg_temp.erreur_de($q$select public.journaliser_suppression_compte('a0630000-0000-0000-0000-0000000000c1', 'Doublon')$q$)
    = 'Ce compte n''est pas supprimé : rien à inscrire au journal.');
select pg_temp.check('0067 : signature : motif borne, profil inconnu',
  pg_temp.erreur_de($q$select public.journaliser_suppression_compte('a0630000-0000-0000-0000-0000000000c2', 'ab')$q$)
    = 'Le motif fait de 3 à 500 caractères.'
  and pg_temp.erreur_de($q$select public.journaliser_suppression_compte('a0670000-0000-0000-0000-00000000ffff', 'Motif')$q$)
    = 'Compte introuvable.');
select public.journaliser_suppression_compte('a0630000-0000-0000-0000-0000000000c2', 'barry <ancien0063@test.gn> — Doublon');
select public.journaliser_suppression_compte('a0630000-0000-0000-0000-0000000000c2', 'Envoi rejoue');
reset role;
select pg_temp.check('0067 : la suppression est signee une seule fois, et rien pour le compte actif',
  (select count(*) = 1 and bool_and(auteur = 'a0630000-0000-0000-0000-0000000000e1'
                                    and motif = 'barry <ancien0063@test.gn> — Doublon')
     from public.journal_equipe
    where action = 'supprimer_compte' and cible_type = 'profil' and cible_id = 'a0630000-0000-0000-0000-0000000000c2')
  and not exists (select 1 from public.journal_equipe
                   where action = 'supprimer_compte' and cible_id = 'a0630000-0000-0000-0000-0000000000c1'));

-- --- L'ordre se refait seul -------------------------------------------
select pg_temp.check('0067 : les positions des categories et des villes vont de 1 a n, sans trou',
  (select bool_and(position = n) from (select position, row_number() over (order by position, name, id) as n
                                         from public.categories) c)
  and (select bool_and(position = n) from (select position, row_number() over (order by position, name, id) as n
                                             from public.cities) v));

-- Trois catégories neuves en fin de liste ; deux à la même position
-- (départagées par le nom) ; on retire celle du milieu.
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.fixer_categorie(p_nom => 'Zeta 67', p_position => 9000) as z67 \gset
select public.fixer_categorie(p_nom => 'Alpha 67', p_position => 9000) as a67 \gset
select public.fixer_categorie(p_nom => 'Milieu 67', p_position => 8000) as mil67 \gset
reset role;
select count(*) as journal_avant from public.journal_equipe \gset
select array_agg(id order by position, name, id) filter (where id <> :mil67) as ordre_attendu from public.categories \gset
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.retirer_categorie(:mil67);
reset role;
select pg_temp.check('0067 : apres un retrait, les categories sont renumerotees 1..n dans le meme ordre',
  (select array_agg(id order by position) from public.categories) = :'ordre_attendu'::int[]
  and (select array_agg(position order by position) from public.categories)
      = (select array_agg(g) from generate_series(1, (select count(*)::int from public.categories)) g)
  and (select position from public.categories where id = :a67) < (select position from public.categories where id = :z67));
select pg_temp.check('0067 : seul le retrait est journalise, pas la renumerotation',
  (select count(*) from public.journal_equipe) = :journal_avant + 1
  and exists (select 1 from public.journal_equipe where action = 'retirer_categorie'
               and cible_id = public.cible_journal_entier(:mil67)));
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.retirer_categorie(:z67);
select public.retirer_categorie(:a67);
select public.fixer_ville(p_nom => 'Boffa 67', p_position => 5000) as vb67 \gset
select public.fixer_ville(p_nom => 'Dabola 67', p_position => 6000) as vd67 \gset
reset role;
select array_agg(id order by position, name, id) filter (where id <> :vb67) as villes_attendues from public.cities \gset
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.retirer_ville(:vb67);
reset role;
select pg_temp.check('0067 : apres un retrait, les villes sont renumerotees 1..n dans le meme ordre',
  (select array_agg(id order by position) from public.cities) = :'villes_attendues'::int[]
  and (select array_agg(position order by position) from public.cities)
      = (select array_agg(g) from generate_series(1, (select count(*)::int from public.cities)) g));
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.retirer_ville(:vd67);
reset role;


-- =====================================================================
-- Un compte supprimé est fermé aussitôt (0068)
-- =====================================================================
-- X : client, la connexion qu'on supprime. Y : client témoin (ses
-- sessions ne doivent pas bouger). M : commerçant, pour le stockage.
-- T (0063) : propriétaire de l'équipe. « Supprimer » = ce que fait le
-- site : profil `is_deleted`, PUIS `banned_until` (couperConnexion).
create or replace function pg_temp.refus_rls(q text) returns boolean
language plpgsql as $$
begin
  execute q;
  return false;
exception when insufficient_privilege then
  return sqlerrm like 'new row violates row-level security policy%';
end $$;

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a0680000-0000-0000-0000-0000000000c1', 'x0068@test.gn', '{"role":"client","full_name":"Xavier X68","phone":"620006801"}', now()),
  ('a0680000-0000-0000-0000-0000000000c2', 'y0068@test.gn', '{"role":"client","full_name":"Yaya Y68","phone":"620006802"}', now()),
  ('a0680000-0000-0000-0000-0000000000a1', 'm0068@test.gn', '{"role":"merchant","full_name":"Marchand M68","phone":"620006803"}', now());
insert into public.merchants (id, profile_id, shop_name, city_id)
select 'a0680000-0000-0000-0000-0000000000b1', p.id, 'Chez M68', 1
  from public.profiles p where p.auth_user_id = 'a0680000-0000-0000-0000-0000000000a1';

-- Deux sessions de X (chacune avec un jeton), un jeton ancien sans
-- session, et une session de Y.
insert into auth.sessions (id, user_id) values
  ('a0680000-0000-0000-0000-0000000005c1', 'a0680000-0000-0000-0000-0000000000c1'),
  ('a0680000-0000-0000-0000-0000000005c2', 'a0680000-0000-0000-0000-0000000000c1'),
  ('a0680000-0000-0000-0000-0000000005c3', 'a0680000-0000-0000-0000-0000000000c2');
insert into auth.refresh_tokens (token, user_id, session_id) values
  ('jx1', 'a0680000-0000-0000-0000-0000000000c1', 'a0680000-0000-0000-0000-0000000005c1'),
  ('jx2', 'a0680000-0000-0000-0000-0000000000c1', 'a0680000-0000-0000-0000-0000000005c2'),
  ('jx0', 'a0680000-0000-0000-0000-0000000000c1', null),
  ('jy1', 'a0680000-0000-0000-0000-0000000000c2', 'a0680000-0000-0000-0000-0000000005c3'),
  ('jy0', 'a0680000-0000-0000-0000-0000000000c2', null);

-- --- Droits ------------------------------------------------------------
select pg_temp.check('0068 : fermer_les_sessions est reservee au serveur',
  not has_function_privilege('anon', 'public.fermer_les_sessions(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.fermer_les_sessions(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.fermer_les_sessions(uuid)', 'execute'));
select pg_temp.check('0068 : ma_connexion_est_fermee est appelable par les policies (anon, authenticated)',
  has_function_privilege('anon', 'public.ma_connexion_est_fermee()', 'execute')
  and has_function_privilege('authenticated', 'public.ma_connexion_est_fermee()', 'execute'));
select pg_temp.check('0068 : les deux fonctions sont security definer, search_path vide',
  (select bool_and(p.prosecdef and p.proconfig = array['search_path=""'])
     from pg_proc p
    where p.oid in ('public.fermer_les_sessions(uuid)'::regprocedure,
                    'public.ma_connexion_est_fermee()'::regprocedure)));

set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
select pg_temp.check('0068 : une session ne ferme pas les sessions (les siennes ni celles d''un autre)',
  pg_temp.refuse($q$select public.fermer_les_sessions('a0680000-0000-0000-0000-0000000000c2')$q$)
  and pg_temp.refuse($q$select public.fermer_les_sessions('a0680000-0000-0000-0000-0000000000c1')$q$));
reset role;

-- --- Fermer les sessions -----------------------------------------------
set role service_role;
select pg_temp.check('0068 : fermer_les_sessions sans connexion leve une erreur',
  pg_temp.erreur_de('select public.fermer_les_sessions(null)') = 'Connexion manquante.');
select pg_temp.check('0068 : fermer_les_sessions rend le nombre de sessions fermees (2)',
  public.fermer_les_sessions('a0680000-0000-0000-0000-0000000000c1') = 2);
reset role;
select pg_temp.check('0068 : plus aucune session ni aucun jeton de X, ancien format compris',
  not exists (select 1 from auth.sessions where user_id = 'a0680000-0000-0000-0000-0000000000c1')
  and not exists (select 1 from auth.refresh_tokens where user_id = 'a0680000-0000-0000-0000-0000000000c1'));
select pg_temp.check('0068 : la session et les jetons de Y sont intacts',
  exists (select 1 from auth.sessions where id = 'a0680000-0000-0000-0000-0000000005c3')
  and (select count(*) from auth.refresh_tokens where user_id = 'a0680000-0000-0000-0000-0000000000c2') = 2);
set role service_role;
select pg_temp.check('0068 : fermer_les_sessions est rejouable (0 la seconde fois)',
  public.fermer_les_sessions('a0680000-0000-0000-0000-0000000000c1') = 0);
reset role;

-- --- Ma connexion est-elle fermée ? -------------------------------------
set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
select pg_temp.check('0068 : une connexion ouverte n''est pas fermee',
  not public.ma_connexion_est_fermee());
reset role;
update auth.users set banned_until = now() - interval '1 minute'
 where id = 'a0680000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.check('0068 : un bannissement echu ne ferme pas',
  not public.ma_connexion_est_fermee());
reset role;
update auth.users set banned_until = null, deleted_at = now()
 where id = 'a0680000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.check('0068 : une connexion supprimee cote Auth (deleted_at) est fermee',
  public.ma_connexion_est_fermee());
select pg_temp.login('a0680000-0000-0000-0000-00000000dead');
select pg_temp.check('0068 : une connexion qui n''existe plus est fermee',
  public.ma_connexion_est_fermee());
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0068 : un visiteur n''a pas de connexion fermee',
  not public.ma_connexion_est_fermee());
reset role;
update auth.users set deleted_at = null where id = 'a0680000-0000-0000-0000-0000000000c1';

-- --- X tant qu'il est ouvert : tout marche (témoins positifs) ------------
set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth_secret)
values ('a0680000-0000-0000-0000-0000000000c1', 'https://push.test/x68', 'p', 's');
select public.enregistrer_telephone('ExponentPushToken[x68]', 'android');
update public.profiles set city_id = 2 where auth_user_id = 'a0680000-0000-0000-0000-0000000000c1';
reset role;
select pg_temp.check('0068 : ouvert, X abonne son navigateur, son telephone et change sa ville',
  exists (select 1 from public.push_subscriptions where endpoint = 'https://push.test/x68')
  and exists (select 1 from public.expo_push_tokens
               where token = 'ExponentPushToken[x68]' and auth_user_id = 'a0680000-0000-0000-0000-0000000000c1')
  and (select city_id from public.profiles where auth_user_id = 'a0680000-0000-0000-0000-0000000000c1') = 2);

-- Le site supprime X : profil effacé, puis connexion bannie. Une
-- transaction annulée prouve d'abord que c'est le BANNISSEMENT qui ferme
-- la recréation (sans lui, 0041 la permet) : la donnée peut faire échouer
-- le contrôle suivant.
update public.profiles set is_deleted = true, deleted_at = now(), full_name = 'Compte supprimé', phone = '000000000'
 where auth_user_id = 'a0680000-0000-0000-0000-0000000000c1';
begin;
set local role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
insert into public.profiles (auth_user_id, role, full_name, phone)
values ('a0680000-0000-0000-0000-0000000000c1', 'client', 'Xavier X68', '620006801');
reset role;
select pg_temp.check('0068 : temoin : supprime mais pas banni, X recree son compte (0041)',
  exists (select 1 from public.profiles
           where auth_user_id = 'a0680000-0000-0000-0000-0000000000c1' and not is_deleted));
rollback;
update auth.users set banned_until = now() + interval '876000 hours'
 where id = 'a0680000-0000-0000-0000-0000000000c1';

set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
select pg_temp.check('0068 : une connexion bannie est fermee',
  public.ma_connexion_est_fermee());
select pg_temp.check('0068 : supprime et banni, X ne recree pas de compte client (jeton encore valable)',
  pg_temp.refus_rls($q$insert into public.profiles (auth_user_id, role, full_name, phone)
    values ('a0680000-0000-0000-0000-0000000000c1', 'client', 'Xavier X68', '620006801')$q$));
select pg_temp.check('0068 : ni de compte boutique',
  pg_temp.refus_rls($q$insert into public.profiles (auth_user_id, role, full_name, phone)
    values ('a0680000-0000-0000-0000-0000000000c1', 'merchant', 'Xavier X68', '620006801')$q$));
select pg_temp.check('0068 : banni, X n''abonne plus de navigateur',
  pg_temp.refus_rls($q$insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth_secret)
    values ('a0680000-0000-0000-0000-0000000000c1', 'https://push.test/x68-bis', 'p', 's')$q$));
update public.push_subscriptions set p256dh = 'change' where endpoint = 'https://push.test/x68';
select pg_temp.check('0068 : banni, X n''enregistre plus de telephone',
  pg_temp.erreur_de($q$select public.enregistrer_telephone('ExponentPushToken[x68bis]', 'ios')$q$)
    = 'Ce compte est fermé.');
update public.profiles set city_id = 3 where auth_user_id = 'a0680000-0000-0000-0000-0000000000c1';
reset role;
select pg_temp.check('0068 : banni, X ne modifie ni son abonnement ni sa ville',
  (select p256dh from public.push_subscriptions where endpoint = 'https://push.test/x68') = 'p'
  and (select city_id from public.profiles where auth_user_id = 'a0680000-0000-0000-0000-0000000000c1') = 2
  and not exists (select 1 from public.expo_push_tokens where token = 'ExponentPushToken[x68bis]'));

-- Un téléphone déjà à Y ne passe pas à X banni (le `on conflict`).
insert into public.expo_push_tokens (auth_user_id, token, plateforme)
values ('a0680000-0000-0000-0000-0000000000c2', 'ExponentPushToken[y68]', 'ios');
set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
select pg_temp.check('0068 : banni, X ne s''approprie pas le telephone de Y',
  pg_temp.erreur_de($q$select public.enregistrer_telephone('ExponentPushToken[y68]', 'ios')$q$) = 'Ce compte est fermé.');
reset role;
select pg_temp.check('0068 : le telephone de Y lui reste',
  (select auth_user_id from public.expo_push_tokens where token = 'ExponentPushToken[y68]')
    = 'a0680000-0000-0000-0000-0000000000c2');

-- État de lecture : un message de l'équipe non lu reste non lu.
insert into public.fil_equipe (fil_de, auteur_id, de_l_equipe, corps, espace)
values ('a0680000-0000-0000-0000-0000000000c1', 'a0630000-0000-0000-0000-0000000000e1', true, 'Bonjour X', 'client');
insert into public.annonces (auteur_id, titre, corps, public, etat)
values ('a0630000-0000-0000-0000-0000000000e1', 'Annonce 0068', 'Pour X', 'clients', 'publiee');
insert into public.annonce_destinataires (annonce_id, auth_user_id)
select a.id, 'a0680000-0000-0000-0000-0000000000c1' from public.annonces a
 where a.titre = 'Annonce 0068'
   and not exists (select 1 from public.annonce_destinataires d
                    where d.annonce_id = a.id and d.auth_user_id = 'a0680000-0000-0000-0000-0000000000c1');
set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
select public.marquer_fil_equipe_lu('client');
select public.marquer_annonces_lues('client');
reset role;
select pg_temp.check('0068 : banni, X ne marque plus le fil de l''equipe lu',
  (select lu_at from public.fil_equipe where fil_de = 'a0680000-0000-0000-0000-0000000000c1') is null);
select pg_temp.check('0068 : banni, X ne marque plus l''annonce lue',
  (select d.lue_at from public.annonce_destinataires d join public.annonces a on a.id = d.annonce_id
    where a.titre = 'Annonce 0068' and d.auth_user_id = 'a0680000-0000-0000-0000-0000000000c1') is null);
update auth.users set banned_until = null where id = 'a0680000-0000-0000-0000-0000000000c1';
set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c1');
select public.marquer_fil_equipe_lu('client');
select public.marquer_annonces_lues('client');
reset role;
select pg_temp.check('0068 : temoin : ouvert, X marque le fil et l''annonce lus',
  (select lu_at from public.fil_equipe where fil_de = 'a0680000-0000-0000-0000-0000000000c1') is not null
  and (select d.lue_at from public.annonce_destinataires d join public.annonces a on a.id = d.annonce_id
        where a.titre = 'Annonce 0068' and d.auth_user_id = 'a0680000-0000-0000-0000-0000000000c1') is not null);

-- Banni SANS profil supprimé (Y, transaction annulée) : seule la garde de
-- connexion ferme la modification du profil.
begin;
update auth.users set banned_until = now() + interval '1 hour'
 where id = 'a0680000-0000-0000-0000-0000000000c2';
set local role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000c2');
update public.profiles set city_id = 3 where auth_user_id = 'a0680000-0000-0000-0000-0000000000c2';
reset role;
select pg_temp.check('0068 : banni avec un profil actif, Y ne modifie pas sa ville',
  (select city_id from public.profiles where auth_user_id = 'a0680000-0000-0000-0000-0000000000c2') is distinct from 3);
rollback;
update auth.users set banned_until = now() + interval '876000 hours'
 where id = 'a0680000-0000-0000-0000-0000000000c1';

-- --- L'équipe -----------------------------------------------------------
begin;
update auth.users set banned_until = now() + interval '876000 hours'
 where id = 'a0630000-0000-0000-0000-0000000000e1';
set local role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0068 : un membre banni n''est plus de l''equipe ni proprietaire',
  not public.je_suis_de_l_equipe() and not public.je_suis_proprietaire());
select pg_temp.check('0068 : un membre banni n''agit plus (ajout refuse)',
  pg_temp.erreur_de($q$select public.ajouter_membre('y0068@test.gn', 'Yaya')$q$) = 'Réservé à l''équipe Filloo.');
select pg_temp.check('0068 : un membre banni ne repond plus dans un fil',
  pg_temp.refus_rls($q$insert into public.fil_equipe (fil_de, auteur_id, de_l_equipe, corps, espace)
    values ('a0680000-0000-0000-0000-0000000000c2', 'a0630000-0000-0000-0000-0000000000e1', true, 'x', 'client')$q$));
rollback;
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0068 : temoin : le proprietaire ouvert reste de l''equipe et proprietaire',
  public.je_suis_de_l_equipe() and public.je_suis_proprietaire());
reset role;

-- --- Suspension : le stockage (trou fermé) ------------------------------
set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000a1');
insert into storage.objects (bucket_id, name) values
  ('product-images', 'a0680000-0000-0000-0000-0000000000b1/p/actif.webp'),
  ('shop-photos', 'a0680000-0000-0000-0000-0000000000b1/actif.webp');
reset role;
select pg_temp.check('0068 : temoin : un commercant actif envoie ses photos',
  (select count(*) from storage.objects where name like 'a0680000-0000-0000-0000-0000000000b1/%') = 2);
update public.profiles set is_suspended = true, suspended_at = now()
 where auth_user_id = 'a0680000-0000-0000-0000-0000000000a1';
set role authenticated;
select pg_temp.login('a0680000-0000-0000-0000-0000000000a1');
select pg_temp.check('0068 : suspendu, un commercant n''envoie plus de photo produit',
  pg_temp.refus_rls($q$insert into storage.objects (bucket_id, name)
    values ('product-images', 'a0680000-0000-0000-0000-0000000000b1/p/suspendu.webp')$q$));
select pg_temp.check('0068 : ni de photo de boutique',
  pg_temp.refus_rls($q$insert into storage.objects (bucket_id, name)
    values ('shop-photos', 'a0680000-0000-0000-0000-0000000000b1/suspendu.webp')$q$));
update storage.objects set name = name || '.x' where name like 'a0680000-0000-0000-0000-0000000000b1/%';
delete from storage.objects where name like 'a0680000-0000-0000-0000-0000000000b1/%';
update public.profiles set city_id = 3 where auth_user_id = 'a0680000-0000-0000-0000-0000000000a1';
reset role;
select pg_temp.check('0068 : suspendu, il ne remplace ni n''efface ses photos',
  (select count(*) from storage.objects
    where name in ('a0680000-0000-0000-0000-0000000000b1/p/actif.webp',
                   'a0680000-0000-0000-0000-0000000000b1/actif.webp')) = 2);
select pg_temp.check('0068 : suspendu, son profil ne se modifie plus (ville)',
  (select city_id from public.profiles where auth_user_id = 'a0680000-0000-0000-0000-0000000000a1') is distinct from 3);


-- =====================================================================
-- Un navigateur sonne pour le compte connecté dessus ; les fonctions de
-- trigger ne s'appellent plus de l'extérieur ; les non-lus se comptent
-- en une requête (0069)
-- =====================================================================
-- P1, P2 : clients qui partagent un navigateur (push). Z : connexion
-- fermée. MA, MB : commerçants (boutiques b1, b2, produits f1, f2).
-- C, D : clients (non-lus).
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a0690000-0000-0000-0000-0000000000c1', 'p1-0069@test.gn', '{"role":"client","full_name":"Penda P1","phone":"620006901"}', now()),
  ('a0690000-0000-0000-0000-0000000000c2', 'p2-0069@test.gn', '{"role":"client","full_name":"Pathe P2","phone":"620006902"}', now()),
  ('a0690000-0000-0000-0000-0000000000c3', 'z0069@test.gn', '{"role":"client","full_name":"Zeinab Z69","phone":"620006903"}', now()),
  ('a0690000-0000-0000-0000-0000000000c4', 'c0069@test.gn', '{"role":"client","full_name":"Client C69","phone":"620006904"}', now()),
  ('a0690000-0000-0000-0000-0000000000c5', 'd0069@test.gn', '{"role":"client","full_name":"Client D69","phone":"620006905"}', now()),
  ('a0690000-0000-0000-0000-0000000000a1', 'ma0069@test.gn', '{"role":"merchant","full_name":"Marchand MA69","phone":"620006906"}', now()),
  ('a0690000-0000-0000-0000-0000000000a2', 'mb0069@test.gn', '{"role":"merchant","full_name":"Marchand MB69","phone":"620006907"}', now());
update public.profiles set id = auth_user_id where auth_user_id::text like 'a0690000-%';
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0690000-0000-0000-0000-0000000000b1', 'a0690000-0000-0000-0000-0000000000a1', 'Chez MA69', 1),
  ('a0690000-0000-0000-0000-0000000000b2', 'a0690000-0000-0000-0000-0000000000a2', 'Chez MB69', 1);
insert into public.products (id, merchant_id, category_id, title, price_gnf) values
  ('a0690000-0000-0000-0000-0000000000f1', 'a0690000-0000-0000-0000-0000000000b1', 3, 'Pagne MA69', 90000),
  ('a0690000-0000-0000-0000-0000000000f2', 'a0690000-0000-0000-0000-0000000000b2', 3, 'Sac MB69', 70000);
insert into public.product_images (product_id, storage_path, position) values
  ('a0690000-0000-0000-0000-0000000000f1', 'a0690000-0000-0000-0000-0000000000b1/f1/0.webp', 0),
  ('a0690000-0000-0000-0000-0000000000f2', 'a0690000-0000-0000-0000-0000000000b2/f2/0.webp', 0);
update public.products set status = 'active' where id::text like 'a0690000-%';

-- --- 1. Push : droits ----------------------------------------------------
select pg_temp.check('0069 : enregistrer_appareil_push est security definer, search_path vide, ouverte a authenticated seul',
  (select p.prosecdef and p.proconfig = array['search_path=""']
     from pg_proc p where p.oid = 'public.enregistrer_appareil_push(text, text, text, text)'::regprocedure)
  and has_function_privilege('authenticated', 'public.enregistrer_appareil_push(text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_appareil_push(text, text, text, text)', 'execute')
  and not has_function_privilege('public', 'public.enregistrer_appareil_push(text, text, text, text)', 'execute'));

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0069 : un visiteur n''enregistre pas d''appareil',
  pg_temp.refuse($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/anon69', 'p', 's')$q$));
reset role;
set role authenticated;
select pg_temp.check('0069 : sans connexion (jeton sans sub), refuse',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/nul69', 'p', 's')$q$)
    = 'Connectez-vous pour recevoir les notifications.');
reset role;

-- --- 1. Push : P1 abonne le navigateur, puis P2 s'y connecte -------------
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c1');
select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/commun69', 'cle-p1', 'secret-p1', 'Navigateur de P1');
reset role;
select pg_temp.check('0069 : P1 enregistre son navigateur',
  (select auth_user_id = 'a0690000-0000-0000-0000-0000000000c1' and p256dh = 'cle-p1'
          and auth_secret = 'secret-p1' and user_agent = 'Navigateur de P1'
     from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69'));
-- La trace d'usage de P1, qui ne doit pas passer à P2.
update public.push_subscriptions
   set last_used_at = now() - interval '1 hour', created_at = now() - interval '10 days'
 where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69';

-- Témoin : le chemin actuel du site (upsert direct) échoue pour P2, avec
-- l'erreur constatée en production.
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c2');
select pg_temp.check('0069 : temoin : l''upsert direct de P2 sur l''appareil de P1 est refuse (USING expression)',
  pg_temp.erreur_de($q$insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth_secret)
    values ('a0690000-0000-0000-0000-0000000000c2', 'https://fcm.googleapis.com/fcm/send/commun69', 'cle-p2', 'secret-p2')
    on conflict (endpoint) do update set auth_user_id = excluded.auth_user_id, p256dh = excluded.p256dh,
      auth_secret = excluded.auth_secret$q$)
    like 'new row violates row-level security policy (USING expression)%');
select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/commun69', 'cle-p2', 'secret-p2');
select pg_temp.check('0069 : P2 voit desormais l''appareil',
  (select count(*) from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69') = 1);
reset role;
select pg_temp.check('0069 : l''appareil appartient a P2, avec ses cles a lui, sur la meme ligne',
  (select count(*) from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69') = 1
  and (select auth_user_id = 'a0690000-0000-0000-0000-0000000000c2' and p256dh = 'cle-p2' and auth_secret = 'secret-p2'
         from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69'));
select pg_temp.check('0069 : rien de P1 ne passe a P2 (navigateur, date d''abonnement, dernier envoi)',
  (select user_agent is null and last_used_at is null and created_at > now() - interval '1 minute'
     from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69'));
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c1');
select pg_temp.check('0069 : P1 ne voit plus l''appareil (ses notifications n''y partent plus)',
  (select count(*) from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69') = 0);
reset role;

-- Même connexion qui se réenregistre (nouvelles clés) : sa trace reste.
update public.push_subscriptions
   set last_used_at = now() - interval '1 hour', created_at = now() - interval '10 days'
 where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69';
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c2');
select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/commun69', 'cle-p2-bis', 'secret-p2-bis', repeat('u', 400));
reset role;
select pg_temp.check('0069 : P2 qui se reabonne garde sa date et son dernier envoi, cles changees, user_agent tronque a 300',
  (select auth_user_id = 'a0690000-0000-0000-0000-0000000000c2' and p256dh = 'cle-p2-bis' and auth_secret = 'secret-p2-bis'
          and length(user_agent) = 300 and last_used_at < now() - interval '30 minutes'
          and created_at < now() - interval '9 days'
     from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69'));

-- --- 1. Push : formes refusées --------------------------------------------
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c2');
select pg_temp.check('0069 : adresse http refusee',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('http://fcm.googleapis.com/x69', 'p', 's')$q$)
    = 'Adresse de notification invalide.');
select pg_temp.check('0069 : adresse absente refusee',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push(null, 'p', 's')$q$)
    = 'Adresse de notification invalide.');
select pg_temp.check('0069 : adresse de 2049 caracteres refusee',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/' || repeat('x', 2049 - 27), 'p', 's')$q$)
    = 'Adresse de notification invalide.');
select pg_temp.check('0069 : adresse avec un espace refusee',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/a b', 'p', 's')$q$)
    = 'Adresse de notification invalide.');
select pg_temp.check('0069 : cle vide refusee',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/k69', '  ', 's')$q$)
    = 'Clés de notification invalides.');
select pg_temp.check('0069 : secret absent refuse',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/k69', 'p', null)$q$)
    = 'Clés de notification invalides.');
select pg_temp.check('0069 : cle de plus de 512 caracteres refusee',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/k69', repeat('p', 513), 's')$q$)
    = 'Clés de notification invalides.');
reset role;
select pg_temp.check('0069 : aucune forme refusee n''a laisse de ligne',
  not exists (select 1 from public.push_subscriptions
               where auth_user_id = 'a0690000-0000-0000-0000-0000000000c2'
                 and endpoint <> 'https://fcm.googleapis.com/fcm/send/commun69'));
-- Témoin des bornes : 2048 et 512 exactement passent.
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c2');
select public.enregistrer_appareil_push('https://fcm.googleapis.com/' || repeat('x', 2048 - 27), repeat('p', 512), repeat('s', 512), '');
reset role;
select pg_temp.check('0069 : temoin : une adresse de 2048 et des cles de 512 passent (user_agent vide = null)',
  exists (select 1 from public.push_subscriptions
           where auth_user_id = 'a0690000-0000-0000-0000-0000000000c2' and length(endpoint) = 2048
             and length(p256dh) = 512 and user_agent is null));

-- --- 1. Push : connexion fermée -------------------------------------------
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c3');
select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/z69', 'cle-z', 'secret-z');
reset role;
select pg_temp.check('0069 : temoin : Z ouvert enregistre son navigateur',
  exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/z69'));
update auth.users set banned_until = now() + interval '876000 hours'
 where id = 'a0690000-0000-0000-0000-0000000000c3';
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c3');
select pg_temp.check('0069 : connexion fermee, Z n''enregistre plus d''appareil',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/z69-bis', 'p', 's')$q$)
    = 'Ce compte est fermé.');
select pg_temp.check('0069 : connexion fermee, Z ne prend pas l''appareil de P2',
  pg_temp.erreur_de($q$select public.enregistrer_appareil_push('https://fcm.googleapis.com/fcm/send/commun69', 'p', 's')$q$)
    = 'Ce compte est fermé.');
reset role;
select pg_temp.check('0069 : l''appareil de P2 lui reste, rien de neuf pour Z',
  (select auth_user_id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/commun69')
    = 'a0690000-0000-0000-0000-0000000000c2'
  and not exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/z69-bis'));

-- --- 2. Fonctions de trigger : plus de droit d'appel ----------------------
select pg_temp.check('0069 : les neuf fonctions visees rendent trigger, sans argument',
  (select count(*) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.pronargs = 0
      and p.prorettype = 'trigger'::regtype
      and p.proname in ('bump_contact_count', 'check_conversation_rate_limit', 'check_message_product',
                        'check_message_rate_limit', 'check_product_publishable', 'handle_new_user',
                        'queue_profile_suspension', 'touch_conversation', 'unpublish_products_without_image')) = 9);
select pg_temp.check('0069 : aucune des neuf n''est executable par public, anon ni authenticated',
  not exists (
    select 1
      from unnest(array['bump_contact_count', 'check_conversation_rate_limit', 'check_message_product',
                        'check_message_rate_limit', 'check_product_publishable', 'handle_new_user',
                        'queue_profile_suspension', 'touch_conversation', 'unpublish_products_without_image']) f,
           unnest(array['public', 'anon', 'authenticated']) r
     where has_function_privilege(r, ('public.' || f || '()')::regprocedure, 'execute')));
select pg_temp.check('0069 : les aides du RLS gardent leur droit pour anon (my_profile_id, merchant_is_public)',
  has_function_privilege('anon', 'public.my_profile_id(public.user_role)', 'execute')
  and has_function_privilege('anon', 'public.merchant_is_public(uuid)', 'execute'));
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c4');
select pg_temp.check('0069 : un utilisateur ne peut plus appeler une fonction de trigger (droit refuse)',
  pg_temp.refuse('select public.touch_conversation()')
  and pg_temp.refuse('select public.handle_new_user()'));
reset role;

-- --- 2. … et leurs triggers se déclenchent toujours ------------------------
-- Tout dans une transaction annulée : les non-lus plus bas partent d'un
-- état connu.
begin;
-- Un commerçant (authenticated) : publier sans photo est refusé
-- (check_product_publishable), retirer la dernière photo dépublie
-- (unpublish_products_without_image).
set local role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000a1');
insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
values ('a0690000-0000-0000-0000-0000000000f3', 'a0690000-0000-0000-0000-0000000000b1', 3, 'Natte MA69', 30000, 'draft');
select pg_temp.check('0069 : declenche par un commercant, check_product_publishable refuse une publication sans photo',
  pg_temp.erreur_de($q$update public.products set status = 'active' where id = 'a0690000-0000-0000-0000-0000000000f3'$q$)
    = 'Un produit doit avoir au moins une photo pour être publié.');
delete from public.product_images where product_id = 'a0690000-0000-0000-0000-0000000000f1';
reset role;
select pg_temp.check('0069 : declenche par un commercant, unpublish_products_without_image depublie le produit sans photo',
  (select status from public.products where id = 'a0690000-0000-0000-0000-0000000000f1') = 'draft');
rollback;

begin;
-- Un client (authenticated) ouvre un fil chez MB et écrit.
set local role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c4');
insert into public.conversations (id, client_id, merchant_id)
values ('a0690000-0000-0000-0000-0000000000d9', 'a0690000-0000-0000-0000-0000000000c4', 'a0690000-0000-0000-0000-0000000000b2');
select pg_temp.check('0069 : declenche par un client, check_message_product exige le produit au premier message',
  pg_temp.erreur_de($q$insert into public.messages (conversation_id, sender_id, body)
    values ('a0690000-0000-0000-0000-0000000000d9', 'a0690000-0000-0000-0000-0000000000c4', 'Bonjour')$q$)
    = 'Le premier message doit préciser le produit concerné.');
insert into public.messages (id, conversation_id, sender_id, product_id, body)
values ('a0690000-0000-0000-0000-0000000009e1', 'a0690000-0000-0000-0000-0000000000d9',
        'a0690000-0000-0000-0000-0000000000c4', 'a0690000-0000-0000-0000-0000000000f2', 'Le sac est-il dispo ?');
reset role;
select pg_temp.check('0069 : declenche par un client, bump_contact_count compte le contact',
  (select contact_count from public.products where id = 'a0690000-0000-0000-0000-0000000000f2') = 1);
select pg_temp.check('0069 : declenche par un client, touch_conversation date le fil',
  (select c.last_message_at = m.created_at
     from public.conversations c join public.messages m on m.conversation_id = c.id
    where m.id = 'a0690000-0000-0000-0000-0000000009e1'));
-- Limite des messages : 100 envoyés aujourd'hui (posés par postgres), le
-- 101e du client est refusé par check_message_rate_limit.
insert into public.messages (conversation_id, sender_id, body)
select 'a0690000-0000-0000-0000-0000000000d9', 'a0690000-0000-0000-0000-0000000000c4', 'm' || g
  from generate_series(1, 99) g;
set local role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c4');
select pg_temp.check('0069 : declenche par un client, check_message_rate_limit bloque le 101e message',
  pg_temp.erreur_de($q$insert into public.messages (conversation_id, sender_id, body)
    values ('a0690000-0000-0000-0000-0000000000d9', 'a0690000-0000-0000-0000-0000000000c4', 'encore')$q$)
    = 'Limite atteinte : 100 messages par jour maximum.');
reset role;
rollback;

begin;
-- Limite des fils : 20 fils ouverts aujourd'hui par D (boutiques posées
-- par postgres), le 21e est refusé par check_conversation_rate_limit.
insert into auth.users (id, email, raw_user_meta_data)
select ('a0690000-0000-0000-0000-0000000010' || lpad(g::text, 2, '0'))::uuid, 'r' || g || '-0069@test.gn',
       '{"role":"merchant","full_name":"Limite","phone":"620006999"}'::jsonb
  from generate_series(1, 20) g;
insert into public.merchants (profile_id, shop_name, city_id)
select p.id, 'Limite ' || p.auth_user_id, 1
  from public.profiles p where p.auth_user_id::text like 'a0690000-0000-0000-0000-0000000010%';
insert into public.conversations (client_id, merchant_id)
select 'a0690000-0000-0000-0000-0000000000c5', m.id
  from public.merchants m join public.profiles p on p.id = m.profile_id
 where p.auth_user_id::text like 'a0690000-0000-0000-0000-0000000010%';
set local role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c5');
select pg_temp.check('0069 : declenche par un client, check_conversation_rate_limit bloque le 21e fil du jour',
  pg_temp.erreur_de($q$insert into public.conversations (client_id, merchant_id)
    values ('a0690000-0000-0000-0000-0000000000c5', 'a0690000-0000-0000-0000-0000000000b2')$q$)
    = 'Limite atteinte : 20 nouvelles conversations par jour maximum.');
reset role;
rollback;

begin;
-- handle_new_user : anon et authenticated n'écrivent pas dans auth.users ;
-- on leur en donne le droit le temps de la transaction, pour prouver
-- que le trigger crée le profil sans qu'ils aient EXECUTE.
grant usage on schema auth to anon, authenticated;
grant insert on auth.users to anon, authenticated;
set local role anon;
insert into auth.users (id, email, raw_user_meta_data)
values ('a0690000-0000-0000-0000-0000000000e1', 'n1-0069@test.gn', '{"role":"client","full_name":"Nouveau N1","phone":"620006911"}');
reset role;
set local role authenticated;
insert into auth.users (id, email, raw_user_meta_data)
values ('a0690000-0000-0000-0000-0000000000e2', 'n2-0069@test.gn', '{"role":"merchant","full_name":"Nouveau N2","phone":"620006912"}');
reset role;
select pg_temp.check('0069 : declenche par anon puis authenticated (sans EXECUTE), handle_new_user cree les profils',
  not has_function_privilege('anon', 'public.handle_new_user()', 'execute')
  and exists (select 1 from public.profiles where auth_user_id = 'a0690000-0000-0000-0000-0000000000e1' and role = 'client')
  and exists (select 1 from public.profiles where auth_user_id = 'a0690000-0000-0000-0000-0000000000e2' and role = 'merchant'));
-- queue_profile_suspension : un rôle sans AUCUN droit sur la fonction
-- (seulement UPDATE sur la table, RLS contourné) suspend un profil.
create role essai_sans_execute_0069 nologin bypassrls;
grant usage on schema public to essai_sans_execute_0069;
grant select, update on public.profiles to essai_sans_execute_0069;
set local role essai_sans_execute_0069;
update public.profiles set is_suspended = true, suspended_at = now()
 where id = 'a0690000-0000-0000-0000-0000000000c1';
reset role;
select pg_temp.check('0069 : declenche par un role sans EXECUTE, queue_profile_suspension met la notification en file',
  not has_function_privilege('essai_sans_execute_0069', 'public.queue_profile_suspension()', 'execute')
  and exists (select 1 from public.notifications
               where profile_id = 'a0690000-0000-0000-0000-0000000000c1' and kind = 'profile_suspended'));
rollback;

-- --- 3. Compter les messages non lus --------------------------------------
-- Fils : C–MA (d1), D–MB (d2), D–MA (d3). Posés par postgres, triggers
-- compris (le premier message de chaque fil cite un produit).
insert into public.conversations (id, client_id, merchant_id) values
  ('a0690000-0000-0000-0000-0000000000d1', 'a0690000-0000-0000-0000-0000000000c4', 'a0690000-0000-0000-0000-0000000000b1'),
  ('a0690000-0000-0000-0000-0000000000d2', 'a0690000-0000-0000-0000-0000000000c5', 'a0690000-0000-0000-0000-0000000000b2'),
  ('a0690000-0000-0000-0000-0000000000d3', 'a0690000-0000-0000-0000-0000000000c5', 'a0690000-0000-0000-0000-0000000000b1');
insert into public.messages (conversation_id, sender_id, product_id, body, read_at) values
  -- d1 : C → MA, 2 non lus + 1 lu ; MA → C, 1 non lu.
  ('a0690000-0000-0000-0000-0000000000d1', 'a0690000-0000-0000-0000-0000000000c4', 'a0690000-0000-0000-0000-0000000000f1', 'c1', null),
  ('a0690000-0000-0000-0000-0000000000d1', 'a0690000-0000-0000-0000-0000000000c4', null, 'c2', null),
  ('a0690000-0000-0000-0000-0000000000d1', 'a0690000-0000-0000-0000-0000000000c4', null, 'c3 lu', now()),
  ('a0690000-0000-0000-0000-0000000000d1', 'a0690000-0000-0000-0000-0000000000a1', null, 'ma1', null),
  -- d2 : D → MB, 3 non lus ; MB → D, 1 non lu.
  ('a0690000-0000-0000-0000-0000000000d2', 'a0690000-0000-0000-0000-0000000000c5', 'a0690000-0000-0000-0000-0000000000f2', 'd1', null),
  ('a0690000-0000-0000-0000-0000000000d2', 'a0690000-0000-0000-0000-0000000000c5', null, 'd2', null),
  ('a0690000-0000-0000-0000-0000000000d2', 'a0690000-0000-0000-0000-0000000000c5', null, 'd3', null),
  ('a0690000-0000-0000-0000-0000000000d2', 'a0690000-0000-0000-0000-0000000000a2', null, 'mb1', null),
  -- d3 : D → MA, 1 non lu ; MA → D, 2 non lus.
  ('a0690000-0000-0000-0000-0000000000d3', 'a0690000-0000-0000-0000-0000000000c5', 'a0690000-0000-0000-0000-0000000000f1', 'd4', null),
  ('a0690000-0000-0000-0000-0000000000d3', 'a0690000-0000-0000-0000-0000000000a1', null, 'ma2', null),
  ('a0690000-0000-0000-0000-0000000000d3', 'a0690000-0000-0000-0000-0000000000a1', null, 'ma3', null);

select pg_temp.check('0069 : compter_messages_non_lus est security invoker, search_path vide, ouverte a authenticated seul',
  (select not p.prosecdef and p.proconfig = array['search_path=""']
     from pg_proc p where p.oid = 'public.compter_messages_non_lus(public.user_role)'::regprocedure)
  and has_function_privilege('authenticated', 'public.compter_messages_non_lus(public.user_role)', 'execute')
  and not has_function_privilege('anon', 'public.compter_messages_non_lus(public.user_role)', 'execute')
  and not has_function_privilege('public', 'public.compter_messages_non_lus(public.user_role)', 'execute'));

set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000a1');
select pg_temp.check('0069 : MA compte 3 non lus (2 de C, 1 de D), ni les siens, ni le lu, ni ceux de MB',
  public.compter_messages_non_lus('merchant') = 3);
select pg_temp.check('0069 : MA sans compte client compte 0 cote client',
  public.compter_messages_non_lus('client') = 0);
select pg_temp.login('a0690000-0000-0000-0000-0000000000a2');
select pg_temp.check('0069 : MB compte 3 non lus (ceux de D), jamais ceux des fils de MA',
  public.compter_messages_non_lus('merchant') = 3);
select pg_temp.login('a0690000-0000-0000-0000-0000000000c4');
select pg_temp.check('0069 : C compte 1 non lu (de MA), pas les siens ni ceux des fils de D',
  public.compter_messages_non_lus('client') = 1);
select pg_temp.check('0069 : C sans boutique compte 0 cote commercant',
  public.compter_messages_non_lus('merchant') = 0);
select pg_temp.login('a0690000-0000-0000-0000-0000000000c5');
select pg_temp.check('0069 : D compte 3 non lus (1 de MB, 2 de MA), pas les 4 qu''il a envoyes',
  public.compter_messages_non_lus('client') = 3);
select pg_temp.login('a0690000-0000-0000-0000-00000000dead');
select pg_temp.check('0069 : une connexion sans profil compte 0',
  public.compter_messages_non_lus('client') = 0 and public.compter_messages_non_lus('merchant') = 0);
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0069 : un visiteur ne compte rien (droit refuse)',
  pg_temp.refuse($q$select public.compter_messages_non_lus('client')$q$));
reset role;
-- Un profil supprimé ne compte plus (comme getMyProfiles, is_deleted).
begin;
update public.profiles set is_deleted = true, deleted_at = now()
 where id = 'a0690000-0000-0000-0000-0000000000c5';
set local role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000c5');
select pg_temp.check('0069 : un profil supprime compte 0',
  public.compter_messages_non_lus('client') = 0);
reset role;
rollback;
-- MA ouvre aussi un compte client (connexion a1, profil a9) et parle à MB
-- comme client : chaque espace ne compte que ses fils. Le RLS ne suffit
-- pas ici (MA voit les fils de ses deux espaces) : ce sont les filtres de
-- la fonction qui séparent.
insert into public.profiles (id, auth_user_id, role, full_name, phone)
values ('a0690000-0000-0000-0000-0000000000a9', 'a0690000-0000-0000-0000-0000000000a1', 'client', 'Marchand MA69', '620006906');
insert into public.conversations (id, client_id, merchant_id)
values ('a0690000-0000-0000-0000-0000000000d4', 'a0690000-0000-0000-0000-0000000000a9', 'a0690000-0000-0000-0000-0000000000b2');
insert into public.messages (conversation_id, sender_id, product_id, body, read_at) values
  ('a0690000-0000-0000-0000-0000000000d4', 'a0690000-0000-0000-0000-0000000000a9', 'a0690000-0000-0000-0000-0000000000f2', 'ma-client1', null),
  ('a0690000-0000-0000-0000-0000000000d4', 'a0690000-0000-0000-0000-0000000000a2', null, 'mb-a-ma', null);
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000a1');
select pg_temp.check('0069 : MA cote client compte 1 (de MB), aucun message de ses fils de commercant',
  public.compter_messages_non_lus('client') = 1);
select pg_temp.check('0069 : MA cote commercant compte toujours 3, rien de son fil de client',
  public.compter_messages_non_lus('merchant') = 3);
select pg_temp.login('a0690000-0000-0000-0000-0000000000a2');
select pg_temp.check('0069 : MB compte aussi le message de MA client (3 -> 4)',
  public.compter_messages_non_lus('merchant') = 4);
reset role;
-- Lire un message le retire du compte.
update public.messages set read_at = now()
 where conversation_id = 'a0690000-0000-0000-0000-0000000000d1' and body = 'c1';
set role authenticated;
select pg_temp.login('a0690000-0000-0000-0000-0000000000a1');
select pg_temp.check('0069 : un message lu sort du compte de MA (3 -> 2)',
  public.compter_messages_non_lus('merchant') = 2);
reset role;

-- ---------------------------------------------------------------------
-- Un compte créé par Google complète lui-même son profil (0073)
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('a0730000-0000-0000-0000-00000000000a', 'g0073@test.gn', '{"full_name":"Awa Google","name":"Awa Google"}', '{"provider":"google","providers":["google"]}'),
  ('a0730000-0000-0000-0000-00000000000b', 'e0073@test.gn', '{"role":"merchant","full_name":"Email Marchand","phone":"620007301"}', '{"provider":"email","providers":["email"]}');
select pg_temp.check('0073 : une connexion Google ne recoit aucun profil automatique',
  not exists (select 1 from public.profiles where auth_user_id = 'a0730000-0000-0000-0000-00000000000a'));
select pg_temp.check('0073 : l''inscription par email cree toujours son profil, avec ses metadonnees',
  (select count(*) from public.profiles where auth_user_id = 'a0730000-0000-0000-0000-00000000000b'
     and role = 'merchant' and full_name = 'Email Marchand' and phone = '620007301') = 1);
select pg_temp.check('0073 : la fonction du declencheur n''est appelable par personne',
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute')
  and not has_function_privilege('anon', 'public.handle_new_user()', 'execute'));

select pg_temp.login('a0730000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('a0730000-0000-0000-0000-00000000000a', 'merchant', 'Awa Google', '620007302');
select pg_temp.check('0073 : la personne Google cree elle-meme son premier profil',
  (select count(*) from public.profiles where auth_user_id = 'a0730000-0000-0000-0000-00000000000a' and role = 'merchant') = 1);
do $$ begin
  insert into public.profiles (auth_user_id, role, full_name, phone)
    values ('a0730000-0000-0000-0000-00000000000b', 'client', 'Usurpation', '620007303');
  raise exception 'ECHEC 0073 : un profil a ete cree pour une autre connexion';
exception when insufficient_privilege then
  raise notice 'OK    0073 : impossible de creer un profil pour une autre connexion';
end $$;
reset role;

-- =====================================================================
-- Un catalogue de mode seulement (0074)
-- =====================================================================
-- MA : commerçant (boutique b1). Produits f1..f4 dans des catégories de
-- la mode ; f5 dans une catégorie de test VISIBLE à sa création puis
-- masquée (le trigger interdit d'y entrer ensuite) : seul `cat.visible`
-- l'écarte de la recherche. Titres « T74 » pour isoler la recherche.
-- --- 1. L'état laissé par la migration (avant la tête de ce fichier) ---
select pg_temp.check('0074 : seize categories de mode visibles, positions 1..16, une famille chacune',
  (select count(*) from categories_apres_migrations where visible) = 16
  and (select array_agg(position order by position) from categories_apres_migrations where visible)
      = (select array_agg(g) from generate_series(1, 16) g)
  and not exists (select 1 from categories_apres_migrations where visible and famille is null)
  and (select famille from categories_apres_migrations where slug = 'chaussures') = 'chaussures'
  and (select count(*) from categories_apres_migrations where famille = 'accessoires') = 5
  and (select name from categories_apres_migrations where slug = 'sous-vetements') = 'Sous-vêtements & Nuit');
select pg_temp.check('0074 : toutes les anciennes categories sont masquees, gardees, apres la mode dans leur ordre',
  (select array_agg(slug order by position) from categories_apres_migrations where not visible)
    = array['alimentation', 'mode', 'electronique', 'beaute', 'maison', 'materiaux', 'enfants', 'sport', 'vehicules']
  and (select array_agg(position order by position) from categories_apres_migrations where not visible)
    = (select array_agg(g) from generate_series(17, 25) g)
  and not exists (select 1 from categories_apres_migrations where not visible and famille is not null));
select pg_temp.check('0074 : la fonction du declencheur n''est appelable par personne',
  not has_function_privilege('anon', 'public.produit_dans_une_categorie_visible()', 'execute')
  and not has_function_privilege('authenticated', 'public.produit_dans_une_categorie_visible()', 'execute'));

select id as cat74_robes from public.categories where slug = 'robes' \gset
select id as cat74_hauts from public.categories where slug = 'hauts' \gset
select id as cat74_chaussures from public.categories where slug = 'chaussures' \gset
select id as cat74_maison from public.categories where slug = 'maison' \gset
insert into public.categories (slug, name, position, visible) values ('test-cachee-0074', 'Cachee 74', 900, true);
select id as cat74_cachee from public.categories where slug = 'test-cachee-0074' \gset

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a0740000-0000-0000-0000-0000000000a1', 'ma0074@test.gn', '{"role":"merchant","full_name":"Marchand MA74","phone":"620007401"}', now());
update public.profiles set id = auth_user_id where auth_user_id::text like 'a0740000-%';
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0740000-0000-0000-0000-0000000000b1', 'a0740000-0000-0000-0000-0000000000a1', 'Chez MA74', 1);

-- --- 2. Le commerçant : création, genre, tailles, couleurs ---------------
set role authenticated;
select pg_temp.login('a0740000-0000-0000-0000-0000000000a1');
-- Exactement l'insertion du site (src/lib/actions/products.ts).
insert into public.products (id, merchant_id, category_id, title, description, price_gnf, is_negotiable, status, genre, tailles, couleurs) values
  ('a0740000-0000-0000-0000-0000000000f1', 'a0740000-0000-0000-0000-0000000000b1', :cat74_robes, 'Robe T74', null, 100000, false, 'draft', 'femme', '{M,L}', '{Rouge}'),
  ('a0740000-0000-0000-0000-0000000000f2', 'a0740000-0000-0000-0000-0000000000b1', :cat74_robes, 'Boubou T74', null, 200000, false, 'draft', 'homme', '{XL}', '{Bleu}'),
  ('a0740000-0000-0000-0000-0000000000f3', 'a0740000-0000-0000-0000-0000000000b1', :cat74_hauts, 'T-shirt T74', null, 300000, false, 'draft', 'mixte', '{M}', '{Noir}'),
  ('a0740000-0000-0000-0000-0000000000f4', 'a0740000-0000-0000-0000-0000000000b1', :cat74_chaussures, 'Baskets T74', null, 400000, false, 'draft', 'enfant', '{30}', '{Rouge}'),
  ('a0740000-0000-0000-0000-0000000000f5', 'a0740000-0000-0000-0000-0000000000b1', :cat74_cachee, 'Cachee T74', null, 100000, false, 'draft', 'femme', '{M}', '{Rouge}');
select pg_temp.check('0074 : un commercant cree un produit de mode avec genre, tailles et couleurs',
  (select genre = 'femme' and tailles = '{M,L}' and couleurs = '{Rouge}'
     from public.products where id = 'a0740000-0000-0000-0000-0000000000f1'));
select pg_temp.check('0074 : un commercant ne cree pas de produit dans une categorie masquee',
  pg_temp.erreur_de(format($q$insert into public.products (merchant_id, category_id, title, price_gnf)
                              values ('a0740000-0000-0000-0000-0000000000b1', %s, 'Canape T74', 1000)$q$, :cat74_maison))
    = 'Cette catégorie n''est plus proposée : choisissez une catégorie de la mode.');
select pg_temp.check('0074 : ni une categorie qui n''existe pas',
  pg_temp.erreur_de($q$insert into public.products (merchant_id, category_id, title, price_gnf)
                       values ('a0740000-0000-0000-0000-0000000000b1', 999999, 'Fantome T74', 1000)$q$)
    = 'Cette catégorie n''est plus proposée : choisissez une catégorie de la mode.');
select pg_temp.check('0074 : un commercant ne deplace pas un produit vers une categorie masquee',
  pg_temp.erreur_de(format($q$update public.products set category_id = %s
                              where id = 'a0740000-0000-0000-0000-0000000000f2'$q$, :cat74_maison))
    = 'Cette catégorie n''est plus proposée : choisissez une catégorie de la mode.');
select pg_temp.check('0074 : il deplace un produit vers une autre categorie visible et modifie genre, tailles, couleurs',
  pg_temp.erreur_de(format($q$update public.products set category_id = %s, genre = 'homme', tailles = '{XL,XXL}', couleurs = '{Bleu}'
                              where id = 'a0740000-0000-0000-0000-0000000000f2'$q$, :cat74_hauts)) is null
  and pg_temp.erreur_de(format($q$update public.products set category_id = %s, tailles = '{XL}'
                              where id = 'a0740000-0000-0000-0000-0000000000f2'$q$, :cat74_robes)) is null);
select pg_temp.check('0074 : genre invalide refuse',
  pg_temp.erreur_de($q$update public.products set genre = 'unisexe' where id = 'a0740000-0000-0000-0000-0000000000f1'$q$)
    like '%products_genre_check%');
select pg_temp.check('0074 : 41 tailles refusees, 40 acceptees',
  pg_temp.erreur_de($q$update public.products set tailles = (select array_agg(g::text) from generate_series(1, 41) g)
                       where id = 'a0740000-0000-0000-0000-0000000000f1'$q$) like '%products_tailles_check%'
  and pg_temp.erreur_de($q$update public.products set tailles = (select array_agg(g::text) from generate_series(1, 40) g)
                       where id = 'a0740000-0000-0000-0000-0000000000f1'$q$) is null);
select pg_temp.check('0074 : 21 couleurs refusees, 20 acceptees (le site en propose 15)',
  pg_temp.erreur_de($q$update public.products set couleurs = (select array_agg('C' || g) from generate_series(1, 21) g)
                       where id = 'a0740000-0000-0000-0000-0000000000f1'$q$) like '%products_couleurs_check%'
  and pg_temp.erreur_de($q$update public.products set couleurs = (select array_agg('C' || g) from generate_series(1, 20) g)
                       where id = 'a0740000-0000-0000-0000-0000000000f1'$q$) is null);
select pg_temp.check('0074 : un element nul ou des listes demesurees sont refuses',
  pg_temp.erreur_de($q$update public.products set tailles = '{M,NULL}' where id = 'a0740000-0000-0000-0000-0000000000f1'$q$)
    like '%products_tailles_check%'
  and pg_temp.erreur_de($q$update public.products set couleurs = array[repeat('x', 401)] where id = 'a0740000-0000-0000-0000-0000000000f1'$q$)
    like '%products_couleurs_check%'
  and pg_temp.erreur_de($q$update public.products set tailles = array[repeat('x', 501)] where id = 'a0740000-0000-0000-0000-0000000000f1'$q$)
    like '%products_tailles_check%');
update public.products set tailles = '{M,L}', couleurs = '{Rouge}' where id = 'a0740000-0000-0000-0000-0000000000f1';
reset role;

insert into public.product_images (product_id, storage_path, position)
  select id, 'a0740000/' || id || '/0.webp', 0 from public.products where id::text like 'a0740000-%';
update public.products set status = 'active' where id::text like 'a0740000-%';
-- f5 : sa catégorie se masque APRÈS coup ; il reste publié.
update public.categories set visible = false where id = :cat74_cachee;

-- --- 3. Un produit déjà dans une catégorie masquée reste modifiable ---
set role authenticated;
select pg_temp.login('a0740000-0000-0000-0000-0000000000a1');
select pg_temp.check('0074 : un produit deja dans une categorie masquee se modifie sans en changer',
  pg_temp.erreur_de($q$update public.products set price_gnf = 110000, category_id = category_id
                       where id = 'a0740000-0000-0000-0000-0000000000f5'$q$) is null);
-- Une instruction ne voit pas son propre changement : vérifier à part.
select pg_temp.check('0074 : ... et la modification a bien pris',
  (select price_gnf from public.products where id = 'a0740000-0000-0000-0000-0000000000f5') = 110000);
reset role;
update public.products set price_gnf = 100000 where id = 'a0740000-0000-0000-0000-0000000000f5';

-- --- 4. La recherche --------------------------------------------------
select pg_temp.check('0074 : une seule search_products, invoker, search_path vide, ouverte a anon et authenticated, pas a public',
  (select count(*) from pg_proc where proname = 'search_products' and pronamespace = 'public'::regnamespace) = 1
  and (select not p.prosecdef and p.proconfig = array['search_path=""']
         from pg_proc p where p.oid = 'public.search_products(text, int, int, text, int, int, text, text, text, bigint, bigint)'::regprocedure)
  and has_function_privilege('anon', 'public.search_products(text, int, int, text, int, int, text, text, text, bigint, bigint)', 'execute')
  and has_function_privilege('authenticated', 'public.search_products(text, int, int, text, int, int, text, text, text, bigint, bigint)', 'execute')
  and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                   where p.oid = 'public.search_products(text, int, int, text, int, int, text, text, text, bigint, bigint)'::regprocedure
                     and a.grantee = 0));
-- Les produits T74 rendus, nommés par la fin de leur id (f1..f5).
create or replace function pg_temp.r74(
  p_genre text default null, p_taille text default null, p_couleur text default null,
  p_prix_min bigint default null, p_prix_max bigint default null, p_category_id int default null)
returns text[] language sql as $$
  select coalesce(array_agg(right(s.product_id::text, 2) order by s.product_id), '{}')
    from public.search_products(p_query => 'T74', p_category_id => p_category_id, p_genre => p_genre,
                                p_taille => p_taille, p_couleur => p_couleur,
                                p_prix_min => p_prix_min, p_prix_max => p_prix_max) s
$$;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0074 : une categorie masquee n''apparait pas dans la recherche (f5 publie, absent)',
  pg_temp.r74() = array['f1', 'f2', 'f3', 'f4']
  and pg_temp.r74(p_category_id => :cat74_cachee) = '{}'
  and exists (select 1 from public.products where id = 'a0740000-0000-0000-0000-0000000000f5' and status = 'active'));
select pg_temp.check('0074 : filtre femme = femme + mixte, sans homme ni enfant',
  pg_temp.r74(p_genre => 'femme') = array['f1', 'f3']);
select pg_temp.check('0074 : filtre homme = homme + mixte',
  pg_temp.r74(p_genre => 'homme') = array['f2', 'f3']);
select pg_temp.check('0074 : filtres enfant et mixte : la valeur exacte seule',
  pg_temp.r74(p_genre => 'enfant') = array['f4'] and pg_temp.r74(p_genre => 'mixte') = array['f3']);
select pg_temp.check('0074 : filtre taille',
  pg_temp.r74(p_taille => 'M') = array['f1', 'f3'] and pg_temp.r74(p_taille => 'XXS') = '{}');
select pg_temp.check('0074 : filtre couleur',
  pg_temp.r74(p_couleur => 'Rouge') = array['f1', 'f4'] and pg_temp.r74(p_couleur => 'Bleu') = array['f2']);
select pg_temp.check('0074 : filtre prix, bornes incluses',
  pg_temp.r74(p_prix_min => 200000, p_prix_max => 300000) = array['f2', 'f3']
  and pg_temp.r74(p_prix_min => 400000) = array['f4']
  and pg_temp.r74(p_prix_max => 100000) = array['f1']);
select pg_temp.check('0074 : filtres combines (femme, M, Rouge, <= 150000)',
  pg_temp.r74(p_genre => 'femme', p_taille => 'M', p_couleur => 'Rouge', p_prix_max => 150000) = array['f1']);
select pg_temp.check('0074 : les anciens appels positionnels et nommes marchent toujours',
  (select count(*) from public.search_products(null, 4)) >= 0
  and (select count(*) from public.search_products('T74', 1)) = 4
  and (select count(*) from public.search_products('T74', null, null, 'recent', 24, 0)) = 4
  and (select count(*) from public.search_products('T74', 1, :cat74_robes, 'popular', 1, 0)) = 1
  and (select count(*) from public.search_products(p_query => 'T74', p_sort => 'recent', p_limit => 24)) = 4
  and (select count(*) from public.search_products(p_limit => 1000)) <= 50);
reset role;

-- --- 5. Les produits sponsorisés --------------------------------------
-- Deux boutiques sinon `distinct on (m.id)` n'en montre qu'un : MA74 a f1
-- (visible) et f5 (masqué) ; on met f5 seul en campagne, puis f1.
insert into public.campagnes (id, merchant_id, type, product_id, duree_jours, statut, debut_at, fin_at) values
  ('a0740000-0000-0000-0000-0000000000c5', 'a0740000-0000-0000-0000-0000000000b1', 'produit',
   'a0740000-0000-0000-0000-0000000000f5', 7, 'active', now() - interval '1 hour', now() + interval '1 day');
set role anon;
select pg_temp.check('0074 : un produit sponsorise d''une categorie masquee n''est pas montre',
  not exists (select 1 from public.produits_sponsorises('T74', null, 4)));
reset role;
insert into public.campagnes (id, merchant_id, type, product_id, duree_jours, statut, debut_at, fin_at) values
  ('a0740000-0000-0000-0000-0000000000c1', 'a0740000-0000-0000-0000-0000000000b1', 'produit',
   'a0740000-0000-0000-0000-0000000000f1', 7, 'active', now() - interval '1 hour', now() + interval '1 day');
set role anon;
select pg_temp.check('0074 : un produit sponsorise d''une categorie visible l''est toujours',
  (select array_agg(product_id) from public.produits_sponsorises('T74', null, 4))
    = array['a0740000-0000-0000-0000-0000000000f1'::uuid]);
reset role;
select pg_temp.check('0074 : produits_sponsorises garde sa signature et ses droits',
  has_function_privilege('anon', 'public.produits_sponsorises(text, int, int)', 'execute')
  and has_function_privilege('authenticated', 'public.produits_sponsorises(text, int, int)', 'execute')
  and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                   where p.oid = 'public.produits_sponsorises(text, int, int)'::regprocedure and a.grantee = 0)
  and (select prosecdef from pg_proc where oid = 'public.produits_sponsorises(text, int, int)'::regprocedure));

-- =====================================================================
-- L'équipe range les catégories : visible ou masquée, et rayon (0075)
-- =====================================================================
-- E75 : membre de l'équipe · N75 : connecté, hors équipe. cat75 : une
-- catégorie de test, visible, rayon vêtements, avec un produit publié
-- « T75 » (boutique MA74) : la masquer est permis et le sort de la
-- recherche.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a0750000-0000-0000-0000-0000000000e1', 't0075@test.gn', '{"role":"client","full_name":"Equipier E75","phone":"620007501"}', now()),
  ('a0750000-0000-0000-0000-0000000000c9', 'n0075@test.gn', '{"role":"client","full_name":"Curieux N75","phone":"620007509"}', now());
update public.profiles set id = auth_user_id where auth_user_id::text like 'a0750000-%';
insert into public.equipe (auth_user_id, nom) values ('a0750000-0000-0000-0000-0000000000e1', 'E75');
insert into public.categories (slug, name, position, visible, famille) values ('test-0075', 'Test 75', 950, true, 'vetements');
select id as cat75 from public.categories where slug = 'test-0075' \gset
insert into public.products (id, merchant_id, category_id, title, price_gnf, status) values
  ('a0750000-0000-0000-0000-0000000000f1', 'a0740000-0000-0000-0000-0000000000b1', :cat75, 'Pagne T75', 50000, 'draft');
insert into public.product_images (product_id, storage_path, position)
  values ('a0750000-0000-0000-0000-0000000000f1', 'a0750000/f1/0.webp', 0);
update public.products set status = 'active' where id = 'a0750000-0000-0000-0000-0000000000f1';

create or replace function pg_temp.n75() returns bigint language sql as $$
  select count(*) from public.search_products(p_query => 'T75')
$$;

select pg_temp.check('0075 : ranger_categorie fermee a anon et a public, ouverte a authenticated, definer, search_path vide',
  not has_function_privilege('anon', 'public.ranger_categorie(int, boolean, text)', 'execute')
  and has_function_privilege('authenticated', 'public.ranger_categorie(int, boolean, text)', 'execute')
  and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                   where p.oid = 'public.ranger_categorie(int, boolean, text)'::regprocedure and a.grantee = 0)
  and (select p.prosecdef and p.proconfig = array['search_path=""']
         from pg_proc p where p.oid = 'public.ranger_categorie(int, boolean, text)'::regprocedure));
select pg_temp.check('0075 : le journal accepte ranger_categorie et garde toutes les actions d''avant',
  (select bool_and(pg_get_constraintdef(c.oid) like '%''' || a || '''%')
     from pg_constraint c,
          unnest(array['suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                       'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                       'demasquer_produit', 'ajouter_membre', 'retirer_membre',
                       'fixer_categorie', 'retirer_categorie', 'fixer_ville', 'retirer_ville',
                       'supprimer_produit', 'supprimer_compte', 'ranger_categorie']) a
    where c.conname = 'journal_equipe_action_check' and c.conrelid = 'public.journal_equipe'::regclass));

-- --- 1. Les refus ------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check('0075 : anon ne range rien (droit refuse)',
  pg_temp.refuse(format('select public.ranger_categorie(%s, false, %L)', :cat75, 'vetements')));
reset role;
set role authenticated;
select pg_temp.login('a0750000-0000-0000-0000-0000000000c9');
select pg_temp.check('0075 : un non-membre ne masque ni ne range rien',
  pg_temp.erreur_de(format('select public.ranger_categorie(%s, false, %L)', :cat75, 'vetements')) = 'Réservé à l''équipe Filloo.'
  and pg_temp.erreur_de(format('select public.ranger_categorie(%s, true, %L)', :cat75, 'accessoires')) = 'Réservé à l''équipe Filloo.');
reset role;
select pg_temp.check('0075 : rien n''a change sous le non-membre',
  (select visible and famille = 'vetements' from public.categories where id = :cat75)
  and not exists (select 1 from public.journal_equipe where action = 'ranger_categorie'));

set role authenticated;
select pg_temp.login('a0750000-0000-0000-0000-0000000000e1');
select pg_temp.check('0075 : rayon invalide ou absent refuse, visibilite absente refusee, id inconnu',
  pg_temp.erreur_de(format('select public.ranger_categorie(%s, true, %L)', :cat75, 'meubles'))
    = 'Choisissez un rayon : vêtements, chaussures ou accessoires.'
  and pg_temp.erreur_de(format('select public.ranger_categorie(%s, true, %L)', :cat75, 'Vetements'))
    = 'Choisissez un rayon : vêtements, chaussures ou accessoires.'
  and pg_temp.erreur_de(format('select public.ranger_categorie(%s, true, null)', :cat75))
    = 'Choisissez un rayon : vêtements, chaussures ou accessoires.'
  and pg_temp.erreur_de(format('select public.ranger_categorie(%s, null, %L)', :cat75, 'vetements'))
    = 'Dites si la catégorie est visible ou masquée.'
  and pg_temp.erreur_de($q$select public.ranger_categorie(999999, true, 'vetements')$q$) = 'Catégorie introuvable.');
reset role;
select pg_temp.check('0075 : ... et rien n''a change',
  (select visible and famille = 'vetements' from public.categories where id = :cat75)
  and not exists (select 1 from public.journal_equipe where action = 'ranger_categorie'));

-- --- 2. Masquer, réafficher, ranger --------------------------------------
set role anon;
select pg_temp.check('0075 : avant : le produit de la categorie est trouve',
  pg_temp.n75() = 1);
reset role;
set role authenticated;
select pg_temp.login('a0750000-0000-0000-0000-0000000000e1');
select public.ranger_categorie(:cat75, false, 'vetements');
reset role;
select pg_temp.check('0075 : un membre masque une categorie qui a des produits, signe au journal',
  (select not visible and famille = 'vetements' from public.categories where id = :cat75)
  and (select count(*) = 1 from public.journal_equipe
        where action = 'ranger_categorie' and cible_type = 'categorie'
          and cible_id = public.cible_journal_entier(:cat75)
          and auteur = 'a0750000-0000-0000-0000-0000000000e1' and auteur_nom = 'E75'
          and motif = 'Test 75 : visible → masquée'));
set role anon;
select pg_temp.check('0075 : une categorie masquee sort de search_products',
  pg_temp.n75() = 0);
reset role;
select pg_temp.check('0075 : ... sans que son produit soit supprime ni depublie',
  exists (select 1 from public.products
           where id = 'a0750000-0000-0000-0000-0000000000f1' and status = 'active' and category_id = :cat75));

set role authenticated;
select pg_temp.login('a0750000-0000-0000-0000-0000000000e1');
select public.ranger_categorie(:cat75, true, 'accessoires');
select public.ranger_categorie(:cat75, true, 'accessoires');
select public.ranger_categorie(p_id => :cat75, p_visible => true, p_famille => 'accessoires');
select public.ranger_categorie(:cat74_maison, false, 'chaussures');
reset role;
select pg_temp.check('0075 : un membre reaffiche et change de rayon, motif lisible ; sans changement rien n''est ecrit',
  (select visible and famille = 'accessoires' from public.categories where id = :cat75)
  and (select count(*) = 2 from public.journal_equipe
        where action = 'ranger_categorie' and cible_id = public.cible_journal_entier(:cat75))
  and exists (select 1 from public.journal_equipe
               where action = 'ranger_categorie' and cible_id = public.cible_journal_entier(:cat75)
                 and motif = 'Test 75 : masquée → visible, rayon vêtements → accessoires'));
select pg_temp.check('0075 : une ancienne categorie sans rayon se range en restant masquee',
  (select not visible and famille = 'chaussures' from public.categories where id = :cat74_maison)
  and exists (select 1 from public.journal_equipe
               where action = 'ranger_categorie' and cible_id = public.cible_journal_entier(:cat74_maison)
                 and motif = 'Maison & Meubles : rayon aucun → chaussures'));
set role anon;
select pg_temp.check('0075 : reaffichee, la categorie revient dans search_products',
  pg_temp.n75() = 1);
reset role;

-- --- 3. La dernière catégorie visible ------------------------------------
-- Toutes masquées sauf cat75 (état remis ensuite) : seule la garde peut
-- refuser, les autres contrôles passent.
create temp table visibles_avant_0075 as select id from public.categories where visible;
update public.categories set visible = false where id <> :cat75;
set role authenticated;
select pg_temp.login('a0750000-0000-0000-0000-0000000000e1');
select pg_temp.check('0075 : la derniere categorie visible ne se masque pas',
  pg_temp.erreur_de(format('select public.ranger_categorie(%s, false, %L)', :cat75, 'accessoires'))
    = 'Impossible de masquer « Test 75 » : c''est la dernière catégorie visible, le site n''aurait plus rien à proposer.');
select pg_temp.check('0075 : ... mais elle change de rayon en restant visible',
  pg_temp.erreur_de(format('select public.ranger_categorie(%s, true, %L)', :cat75, 'chaussures')) is null);
reset role;
select pg_temp.check('0075 : ... et elle est toujours visible, au nouveau rayon',
  (select visible and famille = 'chaussures' from public.categories where id = :cat75));
update public.categories set visible = true where id in (select id from visibles_avant_0075);
set role authenticated;
select pg_temp.login('a0750000-0000-0000-0000-0000000000e1');
select pg_temp.check('0075 : avec une autre categorie visible, elle se masque',
  pg_temp.erreur_de(format('select public.ranger_categorie(%s, false, %L)', :cat75, 'chaussures')) is null);
reset role;
select pg_temp.check('0075 : ... et elle est masquee',
  (select not visible from public.categories where id = :cat75));

-- =====================================================================
-- Un membre de l'équipe n'a ni profil client ni profil vendeur (0076)
-- =====================================================================
-- T63 : propriétaire (0067). Connexions neuves, email confirmé :
-- E76 : sans activité, un profil client ET un profil vendeur sans
--       boutique ; entre dans l'équipe par `ajouter_membre`.
-- Une connexion par critère d'activité, ce critère SEUL (données posées
-- en `postgres`, hors RLS, pour isoler chaque garde) :
-- B76 boutique · C76 conversation comme client · K76 fil qu'il a bloqué
-- (sans y être client) · M76 message envoyé (sans y être client) ·
-- R76 signalement fait · J76 visé par le journal de l'équipe.
-- X76 : cliente ordinaire, client de la conversation de K76 et M76.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a0760000-0000-0000-0000-0000000000e1', 'e0076@test.gn', '{"role":"client","full_name":"Mbalou Equipe76","phone":"620007601"}', now()),
  ('a0760000-0000-0000-0000-0000000000b1', 'b0076@test.gn', '{"role":"merchant","full_name":"Boutiquier B76","phone":"620007602"}', now()),
  ('a0760000-0000-0000-0000-0000000000c1', 'c0076@test.gn', '{"role":"client","full_name":"Client C76","phone":"620007603"}', now()),
  ('a0760000-0000-0000-0000-0000000000a1', 'k0076@test.gn', '{"role":"client","full_name":"Bloqueur K76","phone":"620007604"}', now()),
  ('a0760000-0000-0000-0000-0000000000d1', 'm0076@test.gn', '{"role":"client","full_name":"Auteur M76","phone":"620007605"}', now()),
  ('a0760000-0000-0000-0000-0000000000f1', 'r0076@test.gn', '{"role":"client","full_name":"Signaleur R76","phone":"620007606"}', now()),
  ('a0760000-0000-0000-0000-0000000000f2', 'j0076@test.gn', '{"role":"client","full_name":"Suspendu J76","phone":"620007607"}', now()),
  ('a0760000-0000-0000-0000-0000000000c9', 'x0076@test.gn', '{"role":"client","full_name":"Mbalou Cliente76","phone":"620007609"}', now());
update public.profiles set id = auth_user_id where auth_user_id::text like 'a0760000-%';
insert into public.profiles (id, auth_user_id, role, full_name, phone) values
  ('a0760000-0000-0000-0000-0000000000e2', 'a0760000-0000-0000-0000-0000000000e1', 'merchant', 'Mbalou Equipe76', '620007601');
insert into public.notifications (profile_id, kind) values
  ('a0760000-0000-0000-0000-0000000000e1', 'profile_suspended');
insert into public.merchants (id, profile_id, shop_name, city_id) values
  ('a0760000-0000-0000-0000-0000000000b2', 'a0760000-0000-0000-0000-0000000000b1', 'Chez B76', 1);
insert into public.conversations (id, client_id, merchant_id) values
  ('a0760000-0000-0000-0000-00000000c0c1', 'a0760000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.conversations (id, client_id, merchant_id, blocked_by) values
  ('a0760000-0000-0000-0000-00000000c0c9', 'a0760000-0000-0000-0000-0000000000c9', 'aaaaaaaa-0000-0000-0000-000000000001',
   'a0760000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, product_id, body) values
  ('a0760000-0000-0000-0000-00000000c0c9', 'a0760000-0000-0000-0000-0000000000d1', 'cccccccc-0000-0000-0000-000000000001', 'Bonjour M76');
insert into public.reports (reporter_id, target_type, target_id, reason) values
  ('a0760000-0000-0000-0000-0000000000f1', 'merchant', 'aaaaaaaa-0000-0000-0000-000000000001', 'Signalement R76');
insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif) values
  ('a0630000-0000-0000-0000-0000000000e1', 'T63', 'suspendre', 'profil', 'a0760000-0000-0000-0000-0000000000f2', 'Motif J76');

select pg_temp.check('0076 : fixtures : chaque connexion n''a que son critere d''activite',
  (select count(*) from public.profiles where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1') = 2
  and not exists (select 1 from public.conversations
                   where client_id in ('a0760000-0000-0000-0000-0000000000a1', 'a0760000-0000-0000-0000-0000000000d1'))
  and not exists (select 1 from public.messages where sender_id = 'a0760000-0000-0000-0000-0000000000a1')
  and (select count(*) from public.messages where sender_id = 'a0760000-0000-0000-0000-0000000000d1') = 1);

select pg_temp.check('0076 : les fonctions sont fermees a public, anon, authenticated ; triggers definer, search_path vide',
  (select bool_and(not has_function_privilege('anon', f, 'execute')
                   and not has_function_privilege('authenticated', f, 'execute')
                   and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                                    where p.oid = f::regprocedure and a.grantee = 0)
                   and (select pp.proconfig = array['search_path=""'] from pg_proc pp where pp.oid = f::regprocedure))
     from unnest(array['public.profil_a_une_activite(uuid)', 'public.equipe_sans_profil()',
                       'public.profil_hors_equipe()', 'public.retirer_les_profils_de_l_equipe()']) f)
  and (select bool_and(prosecdef) from pg_proc
        where oid in ('public.equipe_sans_profil()'::regprocedure, 'public.profil_hors_equipe()'::regprocedure)));

-- --- 1. Entrer dans l'équipe sans activité : les profils partent -------
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.ajouter_membre('e0076@test.gn', 'Mbalou');
reset role;
select pg_temp.check('0076 : ajout d''un membre sans activite : ses deux profils sont supprimes',
  exists (select 1 from public.equipe where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1')
  and not exists (select 1 from public.profiles where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1')
  and not exists (select 1 from public.notifications
                   where profile_id in ('a0760000-0000-0000-0000-0000000000e1', 'a0760000-0000-0000-0000-0000000000e2')));
select pg_temp.check('0076 : ... la connexion est marquee et l''ajout journalise',
  (select raw_app_meta_data ->> 'equipe' from auth.users where id = 'a0760000-0000-0000-0000-0000000000e1') = 'true'
  and exists (select 1 from public.journal_equipe
               where action = 'ajouter_membre' and cible_id = 'a0760000-0000-0000-0000-0000000000e1'));

-- --- 2. Une activité refuse l'entrée, rien n'est détruit ---------------
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0076 : ajouter_membre d''un client qui a une conversation : refuse, message clair',
  pg_temp.erreur_de($q$select public.ajouter_membre('c0076@test.gn', 'C')$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
reset role;
select pg_temp.check('0076 : ... il n''est pas dans l''equipe, pas marque, son profil et sa conversation restent, rien au journal',
  not exists (select 1 from public.equipe where auth_user_id = 'a0760000-0000-0000-0000-0000000000c1')
  and (select not (coalesce(raw_app_meta_data, '{}') ? 'equipe') from auth.users where id = 'a0760000-0000-0000-0000-0000000000c1')
  and exists (select 1 from public.profiles where id = 'a0760000-0000-0000-0000-0000000000c1')
  and exists (select 1 from public.conversations where id = 'a0760000-0000-0000-0000-00000000c0c1')
  and not exists (select 1 from public.journal_equipe
                   where action = 'ajouter_membre' and cible_id = 'a0760000-0000-0000-0000-0000000000c1'));

select pg_temp.check('0076 : une boutique refuse l''entree (insert du tableau de bord)',
  pg_temp.erreur_de($q$insert into public.equipe (auth_user_id, nom) values ('a0760000-0000-0000-0000-0000000000b1', 'B')$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
select pg_temp.check('0076 : une conversation comme client refuse l''entree',
  pg_temp.erreur_de($q$insert into public.equipe (auth_user_id, nom) values ('a0760000-0000-0000-0000-0000000000c1', 'C')$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
select pg_temp.check('0076 : un fil bloque par lui refuse l''entree',
  pg_temp.erreur_de($q$insert into public.equipe (auth_user_id, nom) values ('a0760000-0000-0000-0000-0000000000a1', 'K')$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
select pg_temp.check('0076 : un message envoye refuse l''entree',
  pg_temp.erreur_de($q$insert into public.equipe (auth_user_id, nom) values ('a0760000-0000-0000-0000-0000000000d1', 'M')$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
select pg_temp.check('0076 : un signalement fait refuse l''entree',
  pg_temp.erreur_de($q$insert into public.equipe (auth_user_id, nom) values ('a0760000-0000-0000-0000-0000000000f1', 'R')$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
select pg_temp.check('0076 : une trace au journal de l''equipe refuse l''entree',
  pg_temp.erreur_de($q$insert into public.equipe (auth_user_id, nom) values ('a0760000-0000-0000-0000-0000000000f2', 'J')$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
select pg_temp.check('0076 : changer la connexion d''un membre vers un compte actif est refuse aussi',
  pg_temp.erreur_de($q$update public.equipe set auth_user_id = 'a0760000-0000-0000-0000-0000000000b1'
                        where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1'$q$)
    = 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.');
select pg_temp.check('0076 : ... et toutes ces donnees sont intactes',
  (select count(*) from public.profiles where auth_user_id::text like 'a0760000-%') = 7
  and exists (select 1 from public.merchants where id = 'a0760000-0000-0000-0000-0000000000b2')
  and (select count(*) from public.conversations where id::text like 'a0760000-%') = 2
  and exists (select 1 from public.messages where sender_id = 'a0760000-0000-0000-0000-0000000000d1')
  and exists (select 1 from public.reports where reporter_id = 'a0760000-0000-0000-0000-0000000000f1')
  and (select count(*) from public.equipe where auth_user_id::text like 'a0760000-%') = 1);

-- --- 3. Aucun profil pour une connexion de l'équipe ---------------------
set role authenticated;
select pg_temp.login('a0760000-0000-0000-0000-0000000000e1');
select pg_temp.check('0076 : un membre ne se cree pas de profil (completion Google, compte lie)',
  pg_temp.erreur_de($q$insert into public.profiles (auth_user_id, role, full_name, phone)
                       values ('a0760000-0000-0000-0000-0000000000e1', 'client', 'Mbalou', '620007601')$q$)
    = 'Ce compte fait partie de l''équipe Filloo : il n''a ni profil client ni profil vendeur.'
  and pg_temp.erreur_de($q$insert into public.profiles (auth_user_id, role, full_name, phone)
                       values ('a0760000-0000-0000-0000-0000000000e1', 'merchant', 'Mbalou', '620007601')$q$)
    = 'Ce compte fait partie de l''équipe Filloo : il n''a ni profil client ni profil vendeur.');
reset role;
select pg_temp.check('0076 : meme le serveur ne cree ni ne rattache un profil a un membre',
  pg_temp.erreur_de($q$insert into public.profiles (auth_user_id, role, full_name, phone)
                       values ('a0760000-0000-0000-0000-0000000000e1', 'client', 'Mbalou', '620007601')$q$)
    = 'Ce compte fait partie de l''équipe Filloo : il n''a ni profil client ni profil vendeur.'
  and pg_temp.erreur_de($q$update public.profiles set auth_user_id = 'a0760000-0000-0000-0000-0000000000e1'
                        where id = 'a0760000-0000-0000-0000-0000000000f1'$q$)
    = 'Ce compte fait partie de l''équipe Filloo : il n''a ni profil client ni profil vendeur.');
select pg_temp.check('0076 : ... aucun profil n''est apparu',
  not exists (select 1 from public.profiles where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1'));

-- --- 4. Un non-membre s'inscrit comme avant ------------------------------
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('a0760000-0000-0000-0000-00000000e0e1', 'n0076@test.gn', '{"role":"merchant","full_name":"Nouveau N76","phone":"620007611"}', '{"provider":"email","providers":["email"]}'),
  ('a0760000-0000-0000-0000-00000000e0e2', 'g0076@test.gn', '{"full_name":"Google G76"}', '{"provider":"google","providers":["google"]}');
select pg_temp.check('0076 : inscription par email d''un non-membre : profil cree par handle_new_user',
  (select count(*) from public.profiles
    where auth_user_id = 'a0760000-0000-0000-0000-00000000e0e1' and role = 'merchant' and full_name = 'Nouveau N76') = 1);
set role authenticated;
select pg_temp.login('a0760000-0000-0000-0000-00000000e0e2');
insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('a0760000-0000-0000-0000-00000000e0e2', 'client', 'Google G76', '620007612');
insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('a0760000-0000-0000-0000-00000000e0e2', 'merchant', 'Google G76', '620007612');
reset role;
select pg_temp.check('0076 : completion Google puis compte lie d''un non-membre : acceptes',
  (select count(*) from public.profiles where auth_user_id = 'a0760000-0000-0000-0000-00000000e0e2') = 2);

-- --- 5. Retiré de l'équipe : il peut se refaire un profil ----------------
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select public.retirer_membre('a0760000-0000-0000-0000-0000000000e1');
reset role;
select pg_temp.check('0076 : retire de l''equipe : demarque, toujours sans profil, non banni',
  not exists (select 1 from public.equipe where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1')
  and (select not (raw_app_meta_data ? 'equipe') and banned_until is null
         from auth.users where id = 'a0760000-0000-0000-0000-0000000000e1')
  and not exists (select 1 from public.profiles where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1'));
set role authenticated;
select pg_temp.login('a0760000-0000-0000-0000-0000000000e1');
insert into public.profiles (auth_user_id, role, full_name, phone)
  values ('a0760000-0000-0000-0000-0000000000e1', 'client', 'Mbalou Equipe76', '620007601');
reset role;
select pg_temp.check('0076 : ... et se refait un profil client par l''ecran « Completez votre compte »',
  (select count(*) from public.profiles where auth_user_id = 'a0760000-0000-0000-0000-0000000000e1' and role = 'client') = 1);

-- --- 6. La page admin et les statistiques ignorent l'équipe -------------
-- Un membre n'a plus de profil : on en remet un à E75, déclencheur levé,
-- pour que le filtre soit seul à l'écarter. X76 porte le même prénom.
begin;
alter table public.profiles disable trigger profil_hors_equipe;
insert into public.profiles (id, auth_user_id, role, full_name, phone) values
  ('a0760000-0000-0000-0000-0000000075e1', 'a0750000-0000-0000-0000-0000000000e1', 'client', 'Mbalou Equipe75', '620007599');
alter table public.profiles enable trigger profil_hors_equipe;
set role authenticated;
select pg_temp.login('a0630000-0000-0000-0000-0000000000e1');
select pg_temp.check('0076 : equipe_comptes ne liste pas un membre, meme s''il avait un profil',
  (select array_agg(x.auth_user_id order by x.auth_user_id) from public.equipe_comptes('Mbalou', 200) x)
    = array['a0760000-0000-0000-0000-0000000000c9', 'a0760000-0000-0000-0000-0000000000e1']::uuid[]
  and not exists (select 1 from public.equipe_comptes(null, 200, 'client') x
                   where x.auth_user_id = 'a0750000-0000-0000-0000-0000000000e1')
  and not exists (select 1 from public.equipe_comptes('620007599', 200) x));
-- `postgres` et non `service_role` : le stub ne donne pas les tables à
-- `service_role` ; la fonction est `security invoker`, son filtre est le
-- même pour les deux.
reset role;
select pg_temp.check('0076 : suivi_chiffres ne compte pas un membre parmi les clients',
  (public.suivi_chiffres(now() - interval '1 day') -> 'profils' ->> 'clients')::int
    = (select count(*) from public.profiles p
        where p.role = 'client' and not p.is_deleted
          and not exists (select 1 from public.equipe e where e.auth_user_id = p.auth_user_id))
  and (public.suivi_chiffres(now() - interval '1 day') -> 'profils' ->> 'clients')::int
    = (select count(*) from public.profiles p where p.role = 'client' and not p.is_deleted) - 1);
reset role;
rollback;
select pg_temp.check('0076 : equipe_comptes et suivi_chiffres gardent leurs droits',
  has_function_privilege('authenticated', 'public.equipe_comptes(text, int, text)', 'execute')
  and not has_function_privilege('anon', 'public.equipe_comptes(text, int, text)', 'execute')
  and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                   where p.oid = 'public.equipe_comptes(text, int, text)'::regprocedure and a.grantee = 0)
  and (select prosecdef from pg_proc where oid = 'public.equipe_comptes(text, int, text)'::regprocedure)
  and has_function_privilege('service_role', 'public.suivi_chiffres(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.suivi_chiffres(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.suivi_chiffres(timestamptz)', 'execute')
  and not (select prosecdef from pg_proc where oid = 'public.suivi_chiffres(timestamptz)'::regprocedure));
set role authenticated;
select pg_temp.login('a0760000-0000-0000-0000-00000000e0e1');
select pg_temp.check('0076 : equipe_comptes reste fermee a un non-membre',
  pg_temp.erreur_de($q$select * from public.equipe_comptes()$q$) = 'Réservé à l''équipe Filloo.');
reset role;

-- --- 7. Le nettoyage de la migration, rejoué ----------------------------
-- S (0042) reçoit un profil sans activité et E75 un profil avec une
-- conversation (déclencheurs levés : état d'avant 0076).
begin;
alter table public.profiles disable trigger profil_hors_equipe;
insert into public.profiles (id, auth_user_id, role, full_name, phone) values
  ('a0760000-0000-0000-0000-0000000042e1', 'a0420000-0000-0000-0000-000000000005', 'client', 'Collegue S', '620004201'),
  ('a0760000-0000-0000-0000-0000000075e1', 'a0750000-0000-0000-0000-0000000000e1', 'client', 'Equipier E75', '620007501');
alter table public.profiles enable trigger profil_hors_equipe;
insert into public.conversations (client_id, merchant_id) values
  ('a0760000-0000-0000-0000-0000000075e1', 'bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.check('0076 : nettoyage : un membre actif arrete tout, en le nommant',
  pg_temp.erreur_de('select public.retirer_les_profils_de_l_equipe()')
    like '0076 : rien n''est supprimé, ces membres de l''équipe ont déjà une activité sur Filloo : E75.%');
select pg_temp.check('0076 : ... et rien n''est supprime, pas meme le profil sans activite',
  (select count(*) from public.profiles
    where id in ('a0760000-0000-0000-0000-0000000042e1', 'a0760000-0000-0000-0000-0000000075e1')) = 2);
delete from public.conversations where client_id = 'a0760000-0000-0000-0000-0000000075e1';
select pg_temp.check('0076 : nettoyage sans activite : deux profils supprimes',
  public.retirer_les_profils_de_l_equipe() = 2);
select pg_temp.check('0076 : ... ceux des membres, eux seuls',
  not exists (select 1 from public.profiles p join public.equipe e on e.auth_user_id = p.auth_user_id)
  and exists (select 1 from public.profiles where id = 'a0760000-0000-0000-0000-0000000000c9'));
rollback;

-- --- 8. Le cas tranché par le porteur du projet (2026-11-11) -------------
-- S (0042) joue Alpha Nouhou : profil client avec UNE conversation (chez
-- A) et son message ; E75 joue un autre membre actif (conversation chez
-- B). Déclencheur levé : état d'avant 0076.
begin;
alter table public.profiles disable trigger profil_hors_equipe;
insert into public.profiles (id, auth_user_id, role, full_name, phone) values
  ('a0760000-0000-0000-0000-0000000042e1', 'a0420000-0000-0000-0000-000000000005', 'client', 'Collegue S', '620004201'),
  ('a0760000-0000-0000-0000-0000000075e1', 'a0750000-0000-0000-0000-0000000000e1', 'client', 'Equipier E75', '620007501');
alter table public.profiles enable trigger profil_hors_equipe;
insert into public.conversations (id, client_id, merchant_id) values
  ('a0760000-0000-0000-0000-0000000c0042', 'a0760000-0000-0000-0000-0000000042e1', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0760000-0000-0000-0000-0000000c0075', 'a0760000-0000-0000-0000-0000000075e1', 'bbbbbbbb-0000-0000-0000-000000000002');
insert into public.messages (id, conversation_id, sender_id, product_id, body) values
  ('a0760000-0000-0000-0000-0000000e0042', 'a0760000-0000-0000-0000-0000000c0042', 'a0760000-0000-0000-0000-0000000042e1',
   'cccccccc-0000-0000-0000-000000000001', 'Bonjour S');
select pg_temp.check('0076 : decision : un id qui ne designe plus le profil client de ce membre n''efface rien',
  public.effacer_profil_decide('a0760000-0000-0000-0000-0000000042e1', 'Autre nom', 'a0760000-0000-0000-0000-0000000c0042') = 0
  and public.effacer_profil_decide('a0760000-0000-0000-0000-0000000075e1', 'S', 'a0760000-0000-0000-0000-0000000c0075') = 0
  and public.effacer_profil_decide('a0760000-0000-0000-0000-0000000000c1', 'C76', 'a0760000-0000-0000-0000-00000000c0c1') = 0);
select pg_temp.check('0076 : decision : une activite au-dela de la conversation decidee arrete tout',
  pg_temp.erreur_de($q$select public.effacer_profil_decide('a0760000-0000-0000-0000-0000000042e1', 'S',
                                                             'a0760000-0000-0000-0000-0000000c0075')$q$)
    like '0076 : le profil de S a une activité au-delà de la conversation décidée%');
insert into public.conversations (id, client_id, merchant_id) values
  ('a0760000-0000-0000-0000-0000000c4202', 'a0760000-0000-0000-0000-0000000042e1', 'bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.check('0076 : decision : une seconde conversation, sans message, arrete tout aussi',
  pg_temp.erreur_de($q$select public.effacer_profil_decide('a0760000-0000-0000-0000-0000000042e1', 'S',
                                                             'a0760000-0000-0000-0000-0000000c0042')$q$)
    like '0076 : le profil de S a une activité au-delà de la conversation décidée%');
delete from public.conversations where id = 'a0760000-0000-0000-0000-0000000c4202';
insert into public.reports (id, reporter_id, target_type, target_id, reason) values
  ('a0760000-0000-0000-0000-0000000f0042', 'a0760000-0000-0000-0000-0000000042e1', 'merchant', 'bbbbbbbb-0000-0000-0000-000000000002', 'Signalement S');
select pg_temp.check('0076 : decision : un signalement fait arrete tout aussi',
  pg_temp.erreur_de($q$select public.effacer_profil_decide('a0760000-0000-0000-0000-0000000042e1', 'S',
                                                             'a0760000-0000-0000-0000-0000000c0042')$q$)
    like '0076 : le profil de S a une activité au-delà de la conversation décidée%');
delete from public.reports where id = 'a0760000-0000-0000-0000-0000000f0042';
select pg_temp.check('0076 : decision : ... et rien n''a ete efface',
  (select count(*) from public.profiles
    where id in ('a0760000-0000-0000-0000-0000000042e1', 'a0760000-0000-0000-0000-0000000075e1')) = 2
  and exists (select 1 from public.messages where id = 'a0760000-0000-0000-0000-0000000e0042'));
select pg_temp.check('0076 : decision : le membre nomme est efface malgre son activite',
  public.effacer_profil_decide('a0760000-0000-0000-0000-0000000042e1', 'S', 'a0760000-0000-0000-0000-0000000c0042') = 1);
select pg_temp.check('0076 : decision : ... sa conversation et son message partent, l''autre membre reste',
  not exists (select 1 from public.profiles where id = 'a0760000-0000-0000-0000-0000000042e1')
  and not exists (select 1 from public.conversations where id = 'a0760000-0000-0000-0000-0000000c0042')
  and not exists (select 1 from public.messages where id = 'a0760000-0000-0000-0000-0000000e0042')
  and exists (select 1 from public.profiles where id = 'a0760000-0000-0000-0000-0000000075e1')
  and exists (select 1 from public.conversations where id = 'a0760000-0000-0000-0000-0000000c0075'));
select pg_temp.check('0076 : decision : un autre membre actif fait toujours echouer le nettoyage',
  pg_temp.erreur_de('select public.retirer_les_profils_de_l_equipe()')
    like '0076 : rien n''est supprimé, ces membres de l''équipe ont déjà une activité sur Filloo : E75.%');
select pg_temp.check('0076 : decision : la fonction est fermee a public, anon, authenticated',
  not has_function_privilege('anon', 'public.effacer_profil_decide(uuid, text, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.effacer_profil_decide(uuid, text, uuid)', 'execute')
  and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
                   where p.oid = 'public.effacer_profil_decide(uuid, text, uuid)'::regprocedure and a.grantee = 0));
rollback;

\echo ''
\echo '===== TOUS LES TESTS SONT PASSES ====='
