-- =====================================================================
-- Makiti — tests de sécurité
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
-- 2. Un commerçant non validé prépare mais ne publie pas
-- =====================================================================
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');

insert into public.products (id, merchant_id, category_id, title, price_gnf, status)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        1, 'Sac de riz importé 50kg', 450000, 'draft');

do $$
begin
  update public.products set status = 'active'
   where id = 'cccccccc-0000-0000-0000-000000000001';
  raise exception 'ECHEC un commerçant en attente a pu publier';
exception when others then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    publication refusée tant que la boutique n''est pas validée';
end $$;

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

-- Même logique pour le motif de refus : lui aussi n'appartient qu'à
-- l'administrateur. Sinon un commerçant refusé pourrait effacer la trace
-- de son propre refus, ou en inventer une plus flatteuse.
do $$
begin
  update public.merchants set rejection_reason = 'raison inventée'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  raise exception 'ECHEC un commerçant a pu écrire son motif de refus';
exception when insufficient_privilege then
  raise notice 'OK    écriture du motif de refus réservée à l''admin';
end $$;

reset role;
update public.merchants set status = 'approved', approved_at = now()
 where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');


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
-- 5. Maximum 3 photos, garanti par la structure
-- =====================================================================
insert into public.product_images (product_id, storage_path, position) values
  ('cccccccc-0000-0000-0000-000000000001', 'x/1.webp', 1),
  ('cccccccc-0000-0000-0000-000000000001', 'x/2.webp', 2);

do $$
begin
  insert into public.product_images (product_id, storage_path, position)
  values ('cccccccc-0000-0000-0000-000000000001', 'x/3.webp', 3);
  raise exception 'ECHEC une 4e photo a été acceptée';
exception when check_violation then
  raise notice 'OK    4e photo refusée par la contrainte';
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

-- Boutique A a bloqué : elle peut donc toujours écrire...
insert into public.messages (conversation_id, sender_id, product_id, body)
values ('dddddddd-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'cccccccc-0000-0000-0000-000000000001', 'Dernier mot du bloqueur');
reset role;

-- ...mais Client D, bloqué, ne peut plus.
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
-- 22. Valider une boutique : un seul geste, et réservé à l'administrateur
-- =====================================================================
-- 0012 rend `merchants.status` suffisant à lui seul (la date de
-- validation se pose, un motif périmé s'effrace, un refus sans motif est
-- refusé). Le risque de ce genre de confort, c'est d'ouvrir un chemin
-- d'auto-validation : c'est la faille que la partie 4 de 0002 avait
-- fermée, et ces tests sont ce qui l'empêche de se rouvrir.

insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'g@test.gn',
   '{"role":"merchant","full_name":"Boutique G","phone":"620000007"}');

insert into public.merchants (profile_id, shop_name, city_id)
  select id, 'Boutique G', 1 from public.profiles where full_name = 'Boutique G';

-- Approuver en écrivant la SEULE colonne `status` remplit la date.
update public.merchants set status = 'approved' where shop_name = 'Boutique G';

select pg_temp.check('approuver pose la date de validation toute seule',
  (select approved_at is not null from public.merchants where shop_name = 'Boutique G'));

-- Un refus sans motif est refusé par la base, pas rattrapé en silence.
do $$
begin
  update public.merchants set status = 'rejected' where shop_name = 'Boutique G';
  raise exception 'ECHEC un refus sans motif a été accepté';
exception when check_violation then
  raise notice 'OK    un refus sans motif est refuse';
end $$;

-- Un motif de refus ne survit pas à une nouvelle validation : il
-- réapparaîtrait sur /vendeur/refusee comme s'il venait d'être écrit.
update public.merchants
   set status = 'rejected', rejection_reason = 'Motif temporaire de test.'
 where shop_name = 'Boutique G';
update public.merchants set status = 'approved' where shop_name = 'Boutique G';

select pg_temp.check('revalider effrace le motif de refus perime',
  (select rejection_reason is null from public.merchants where shop_name = 'Boutique G'));

-- Et le point qui compte : le commerçant PROPRIÉTAIRE ne peut pas
-- s'auto-valider, ni en écrivant la colonne, ni par la fonction.
update public.merchants set status = 'pending' where shop_name = 'Boutique G';

select pg_temp.login('77777777-7777-7777-7777-777777777777');
set role authenticated;

do $$
begin
  update public.merchants set status = 'approved' where shop_name = 'Boutique G';
  raise exception 'ECHEC un commerçant a écrit son propre status';
exception when insufficient_privilege then
  raise notice 'OK    un commercant ne peut pas ecrire son propre status';
end $$;

do $$
begin
  perform public.approve_merchant('Boutique G');
  raise exception 'ECHEC un commerçant a pu appeler approve_merchant()';
exception when insufficient_privilege then
  raise notice 'OK    approve_merchant() n''est pas appelable par un commercant';
end $$;

reset role;

select pg_temp.check('la boutique est restee en attente malgre les deux tentatives',
  (select status from public.merchants where shop_name = 'Boutique G') = 'pending');


-- =====================================================================
-- 23. Une boutique suspendue quitte la vitrine (0013)
-- =====================================================================
-- La suspension vit sur `profiles.is_suspended`, la visibilité sur
-- `merchants.status` : rien ne reliait les deux, et un commerçant
-- suspendu gardait boutique, produits et bouton « Contacter ». Le pire
-- n'était pas qu'il reste visible, c'est qu'on pouvait lui ÉCRIRE sans
-- qu'il puisse jamais répondre.

update public.merchants set status = 'approved' where shop_name = 'Boutique G';
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
-- 12. Renvoyer une boutique refusée à la vérification (0015)
-- =====================================================================
-- La règle du projet : toute nouvelle porte ouverte dans la base
-- s'accompagne d'un test qui prouve ce qu'elle NE laisse PAS faire.
-- `resubmit_my_merchant()` est `security definer` — donc exécutée avec les
-- droits du propriétaire de la fonction, RLS contourné — et c'est
-- précisément le genre de fonction qui a déjà rouvert une faille ici
-- (voir 0012). Ces vérifications tiennent sa promesse, clause par clause :
-- une seule transition ('rejected' → 'pending'), sur sa propre boutique,
-- jamais vers 'approved', jamais pour un compte suspendu, jamais pour un
-- anonyme ni pour un compte client.

reset role;
update public.merchants
   set status = 'rejected', rejection_reason = 'Numéro injoignable'
 where shop_name in ('Chez A', 'Chez B');

-- 1. Le commerçant renvoie SA boutique : c'est le parcours attendu.
select pg_temp.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
select public.resubmit_my_merchant();
reset role;
select pg_temp.check('une boutique refusee repasse en attente',
  (select status from public.merchants where shop_name = 'Chez A') = 'pending');
-- Le motif périmé s'efface (trigger de 0012) : il décrivait un refus qui
-- n'a plus cours.
select pg_temp.check('le motif de refus disparait au renvoi',
  (select rejection_reason from public.merchants where shop_name = 'Chez A') is null);
-- Et la boutique du voisin, refusée elle aussi, n'a pas bougé d'un pouce.
select pg_temp.check('renvoyer la sienne ne touche pas celle du voisin',
  (select status from public.merchants where shop_name = 'Chez B') = 'rejected');

-- 2. Rien à renvoyer : la fonction refuse au lieu de mentir.
select pg_temp.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
begin
  perform public.resubmit_my_merchant();
  raise exception 'ECHEC une boutique en attente a ete renvoyee une seconde fois';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    une boutique non refusee ne se renvoie pas';
end $$;

-- 3. Toujours aucun droit d'écriture sur `status` : renvoyer n'est pas
--    s'auto-valider, et la liste blanche de colonnes de 0002 tient.
do $$
begin
  update public.merchants set status = 'approved'
   where profile_id = public.my_profile_id('merchant');
  raise exception 'ECHEC un commercant s''est auto-valide apres 0015';
exception when insufficient_privilege then
  raise notice 'OK    renvoyer sa boutique ne donne pas le droit de la valider';
end $$;

-- 4. Un visiteur non connecté n'a même pas le droit d'appeler la fonction.
reset role;
select pg_temp.login(null);
set role anon;
do $$
begin
  perform public.resubmit_my_merchant();
  raise exception 'ECHEC un anonyme a appele resubmit_my_merchant';
exception when insufficient_privilege then
  raise notice 'OK    un anonyme ne peut pas appeler resubmit_my_merchant';
end $$;
reset role;

-- 5. Le cas le plus dangereux, posé explicitement : A est APPROUVÉE, B est
--    REFUSÉE. Si la fonction se trompait de boutique ou de transition, ce
--    test le dirait — il vérifie les deux à la fois.
--    'approved' → 'pending' déclasserait une boutique validée ; toucher
--    celle du voisin serait pire encore, puisque la sienne est justement
--    dans l'état que la fonction sait traiter.
reset role;
update public.merchants set status = 'approved' where shop_name = 'Chez A';
update public.merchants
   set status = 'rejected', rejection_reason = 'Numéro injoignable'
 where shop_name = 'Chez B';

select pg_temp.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
begin
  perform public.resubmit_my_merchant();
  raise exception 'ECHEC une boutique approuvee a ete renvoyee en attente';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    une boutique approuvee ne repasse pas en attente';
end $$;
reset role;
select pg_temp.check('une boutique approuvee reste approuvee',
  (select status from public.merchants where shop_name = 'Chez A') = 'approved');
select pg_temp.check('la boutique refusee du voisin reste refusee',
  (select status from public.merchants where shop_name = 'Chez B') = 'rejected');

-- 6. Un commerçant SUSPENDU ne renvoie pas sa boutique. La fonction
--    contourne le RLS par construction : sans ce test, rien ne prouverait
--    qu'elle n'est pas devenue la porte dérobée de la suspension.
reset role;
update public.merchants
   set status = 'rejected', rejection_reason = 'Numéro injoignable'
 where shop_name = 'Chez A';
update public.profiles set is_suspended = true
 where id = '11111111-1111-1111-1111-111111111111';

select pg_temp.login('11111111-1111-1111-1111-111111111111');
set role authenticated;
do $$
begin
  perform public.resubmit_my_merchant();
  raise exception 'ECHEC un commercant suspendu a renvoye sa boutique';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    un commercant suspendu ne renvoie pas sa boutique';
end $$;
reset role;
select pg_temp.check('la boutique du commercant suspendu reste refusee',
  (select status from public.merchants where shop_name = 'Chez A') = 'rejected');
update public.profiles set is_suspended = false
 where id = '11111111-1111-1111-1111-111111111111';

-- 7. Un compte CLIENT n'a pas de boutique à renvoyer, et la fonction ne
--    doit pas en trouver une pour lui.
select pg_temp.login('33333333-3333-3333-3333-333333333333');
set role authenticated;
do $$
begin
  perform public.resubmit_my_merchant();
  raise exception 'ECHEC un client a appele resubmit_my_merchant';
exception when raise_exception then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK    un compte client ne renvoie aucune boutique';
end $$;
reset role;
select pg_temp.check('aucune boutique n''a bouge sur appel d''un client',
  (select count(*) from public.merchants where status = 'rejected') = 2);



-- =====================================================================
-- 24. Une conversation survit à la suspension de la boutique (0016)
-- =====================================================================
-- Le pendant du test 23 : celui-ci vérifie ce que la suspension NE doit
-- PAS emporter. 23 prouve qu'un commerçant suspendu quitte la vitrine,
-- 24 prouve qu'il ne disparaît pas des fils déjà ouverts — sinon le
-- client perd l'accès à son propre historique, et `/messages/[id]`
-- répond « page introuvable » pour une conversation qui est la sienne.

reset role;
update public.merchants set status = 'approved' where shop_name = 'Boutique G';
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
update public.merchants set status = 'approved' where shop_name = 'Chez A';
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
update public.merchants set status = 'approved' where shop_name = 'Chez B';
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
update public.merchants set status = 'approved' where shop_name = 'Boutique G';
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
-- question : `execute` lui est révoqué (0017), comme pour
-- `resubmit_my_merchant` (0015).
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

-- (f) Une boutique renvoyée à la VÉRIFICATION n'est pas une boutique
--     suspendue : ses fils continuent. C'est la raison pour laquelle
--     0017 n'emploie pas `merchant_is_public`, qui exige 'approved' —
--     sans ce test, un futur « simplifions, une seule fonction » gèlerait
--     les conversations d'un commerçant qui n'a rien fait de mal.
update public.merchants set status = 'pending' where shop_name = 'Boutique G';
select pg_temp.login('44444444-4444-4444-4444-444444444444');
set role authenticated;
select pg_temp.check('une boutique en attente de validation garde ses fils ouverts',
  public.conversation_is_open(
    (select c.id from public.conversations c
       join public.merchants m on m.id = c.merchant_id
      where c.client_id = '44444444-4444-4444-4444-444444444444'
        and m.shop_name = 'Boutique G')));
reset role;
update public.merchants set status = 'approved' where shop_name = 'Boutique G';


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
-- 28. Valider une boutique d'un seul clic (0018)
-- =====================================================================
-- Une case à cocher posée sur une table d'administration est un confort,
-- et « un confort administratif est le moment exact où l'on rouvre une
-- faille » (section 5). Ces vérifications existent pour que ce confort
-- ne devienne jamais un bouton d'auto-validation.

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-8888-8888-8888-888888888888', 'h@test.gn',
   '{"role":"merchant","full_name":"Boutique H","phone":"620000008"}');
insert into public.merchants (profile_id, shop_name, city_id)
  select id, 'Boutique H', 1 from public.profiles where full_name = 'Boutique H';

select pg_temp.check('une boutique neuve est en attente, case decochee',
  (select status = 'pending' and valider = false
     from public.merchants where shop_name = 'Boutique H'));

-- 1. Le clic : valide, date posée, case redevenue décochée.
update public.merchants set valider = true where shop_name = 'Boutique H';
select pg_temp.check('cocher la case valide la boutique',
  (select status from public.merchants where shop_name = 'Boutique H') = 'approved');
-- La date est la moitié qu'on perd le plus facilement : le trigger de
-- 0012 est déclaré `before update OF status`, donc une commande qui ne
-- mentionne que `valider` ne le réveille pas. Mesuré avant d'écrire
-- 0018 : sans sa propre pose de date, la boutique était validée SANS
-- qu'on puisse dire quand. Ce test est ce qui empêche de « simplifier »
-- 0018 en supprimant ces trois lignes.
select pg_temp.check('cocher la case pose la date de validation',
  (select approved_at is not null from public.merchants where shop_name = 'Boutique H'));
select pg_temp.check('la case se decoche d''elle-meme',
  (select valider = false from public.merchants where shop_name = 'Boutique H'));

-- 2. Recocher ne doit pas réécrire une date de validation déjà posée :
--    sinon l'ancienneté d'une boutique se perd au premier clic distrait.
do $$
declare d1 timestamptz;
begin
  select approved_at into d1 from public.merchants where shop_name = 'Boutique H';
  perform pg_sleep(0.05);
  update public.merchants set valider = true where shop_name = 'Boutique H';
  if (select approved_at from public.merchants where shop_name = 'Boutique H') <> d1 then
    raise exception 'ECHEC recocher a deplace la date de validation';
  end if;
  raise notice 'OK    recocher ne deplace pas la date de validation';
end $$;

-- 3. Une boutique refusée, validée par la case, perd son motif périmé —
--    comme le ferait une validation écrite à la main (0012).
update public.merchants set status = 'rejected', rejection_reason = 'Numero injoignable'
 where shop_name = 'Boutique H';
update public.merchants set valider = true where shop_name = 'Boutique H';
select pg_temp.check('la case valide aussi une boutique refusee',
  (select status from public.merchants where shop_name = 'Boutique H') = 'approved');
select pg_temp.check('et efface le motif de refus perime',
  (select rejection_reason is null from public.merchants where shop_name = 'Boutique H'));

-- 4. LE test de cette section : la case n'est pas un bouton
--    d'auto-validation. C'est la toute première faille trouvée par ce
--    fichier, reprise sous une autre forme.
select pg_temp.login('88888888-8888-8888-8888-888888888888');
set role authenticated;
do $$
begin
  update public.merchants set valider = true where shop_name = 'Boutique H';
  raise exception 'ECHEC un commercant a coche sa propre case de validation';
exception when insufficient_privilege then
  raise notice 'OK    un commercant ne peut pas cocher sa case de validation';
end $$;
-- Et il garde ce qui lui revient : la restriction porte sur UNE colonne,
-- pas sur sa boutique.
update public.merchants set description = 'Vente de tissus'
 where shop_name = 'Boutique H';
reset role;
select pg_temp.check('il modifie toujours sa propre description',
  (select description from public.merchants where shop_name = 'Boutique H') = 'Vente de tissus');

select pg_temp.login(null);
set role anon;
do $$
begin
  update public.merchants set valider = true where shop_name = 'Boutique H';
  raise exception 'ECHEC un anonyme a coche une case de validation';
exception when insufficient_privilege then
  raise notice 'OK    un anonyme ne peut pas cocher une case de validation';
end $$;
reset role;

-- 5. Décocher ne dévalide pas : retirer une boutique du catalogue est un
--    autre geste, qui passe par `status` et exige un motif si c'est un
--    refus. Une case qui ferait les deux serait un interrupteur, et un
--    interrupteur se heurte par accident.
update public.merchants set valider = false where shop_name = 'Boutique H';
select pg_temp.check('decocher ne devalide pas la boutique',
  (select status from public.merchants where shop_name = 'Boutique H') = 'approved');

\echo ''
\echo '===== TOUS LES TESTS SONT PASSES ====='
