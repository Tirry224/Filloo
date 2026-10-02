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
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

update public.merchants set photo_path = 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select pg_temp.check('un commercant pose la photo de sa boutique',
  (select photo_path = 'aaaaaaaa-0000-0000-0000-000000000001/moi.webp'
     from public.merchants where id = 'aaaaaaaa-0000-0000-0000-000000000001'));

-- La faille que la contrainte ferme : afficher la photo d'un concurrent.
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
do $$
begin
  update public.merchants set photo_path = 'bbbbbbbb-0000-0000-0000-000000000002/sa-photo.webp'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'ECHEC une boutique affiche la photo d''une autre';
exception when check_violation then
  raise notice 'OK    la photo d''une autre boutique est refusee';
end $$;
do $$
begin
  update public.merchants set photo_path = 'aaaaaaaa-0000-0000-0000-000000000001/../bbbbbbbb-0000-0000-0000-000000000002/x.webp'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'ECHEC un chemin en .. passe la contrainte';
exception when check_violation then
  raise notice 'OK    un chemin en .. est refuse';
end $$;

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

\echo ''
\echo '===== TOUS LES TESTS SONT PASSES ====='
