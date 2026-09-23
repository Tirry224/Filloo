-- =====================================================================
-- Filloo — jeu de DÉMONSTRATION
-- =====================================================================
-- CE FICHIER N'EST PAS UNE MIGRATION. Il ne décrit pas le schéma, il
-- remplit la base de fausses boutiques pour qu'on puisse REGARDER les
-- écrans. Il est donc volontairement hors de `migrations/` : une migration
-- se rejoue sur toutes les bases, y compris celle du lancement. Pas ça.
--
-- À supprimer AVANT d'ouvrir l'application à de vrais commerçants. La
-- commande de nettoyage est tout en bas : une seule ligne.
--
-- Pourquoi de faux comptes plutôt que des lignes insérées à la main ? Parce
-- qu'un jeu de démonstration qui contourne les règles ne démontre rien. Ici
-- les profils sont créés par le trigger `handle_new_user`, et les produits
-- suivent le chemin imposé par `check_product_publishable` : brouillon,
-- puis photo, puis publication. Si une de ces règles se cassait, ce fichier
-- refuserait de s'exécuter — c'est un test déguisé.
--
-- Exécution : éditeur SQL de Supabase, d'un seul bloc.
-- =====================================================================


-- --- 1. Deux commerçants -----------------------------------------------
-- Domaine `.local` : il n'existe pas et ne peut pas exister. Aucun message
-- ne partira jamais vers ces adresses, même par accident.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000',
   'd0000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated',
   'aissatou@demo.filloo.local', extensions.crypt('demo-filloo-2026', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"role":"merchant","full_name":"Aïssatou Barry","phone":"622334455"}'::jsonb,
   now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   'd0000000-0000-4000-a000-000000000002', 'authenticated', 'authenticated',
   'kaloum@demo.filloo.local', extensions.crypt('demo-filloo-2026', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"role":"merchant","full_name":"Mamadou Sylla","phone":"622110022"}'::jsonb,
   now(), now())
on conflict (id) do nothing;


-- --- 2. Leurs boutiques, validées ---------------------------------------
insert into public.merchants (id, profile_id, shop_name, description, whatsapp_phone, city_id, address_hint, status, approved_at)
select
  m.id, p.id, m.shop_name, m.description, m.whatsapp_phone,
  (select id from public.cities where name = 'Conakry'),
  m.address_hint, 'approved', now()
from (values
  ('b0000000-0000-4000-a000-000000000001'::uuid, 'd0000000-0000-4000-a000-000000000001'::uuid,
   'Chez Aïssatou', 'Alimentation générale : riz, huile, sucre, lait.', '622334455',
   'Marché de Madina, allée 3'),
  ('b0000000-0000-4000-a000-000000000002'::uuid, 'd0000000-0000-4000-a000-000000000002'::uuid,
   'Tech Kaloum', 'Téléphones, accessoires et petit électroménager.', '622110022',
   'Avenue de la République')
) as m(id, auth_id, shop_name, description, whatsapp_phone, address_hint)
join public.profiles p on p.auth_user_id = m.auth_id
on conflict (id) do nothing;


-- --- 3. Les produits, en brouillon ---------------------------------------
-- Des titres et des prix RÉELS, pas « Produit 1 ». Un écran rempli de faux
-- contenu neutre paraît toujours réussi ; c'est « Sac de riz importé 50 kg »
-- à 450 000 GNF qui révèle qu'un titre déborde ou qu'un prix est illisible.
insert into public.products (id, merchant_id, category_id, title, description, price_gnf, is_negotiable, is_featured, status)
values
  ('c0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000001',
   (select id from public.categories where slug = 'alimentation'),
   'Sac de riz importé 50 kg',
   'Riz parfumé importé, sac de 50 kg. Qualité contrôlée. Retrait sur place au marché de Madina, livraison possible dans Conakry.',
   450000, true, true, 'draft'),
  ('c0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000002',
   (select id from public.categories where slug = 'electronique'),
   'Téléphone Tecno Spark 10', 'Neuf sous emballage, garantie 6 mois.',
   850000, false, false, 'draft'),
  ('c0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000001',
   (select id from public.categories where slug = 'alimentation'),
   'Bidon d''huile 20 L', null, 320000, false, false, 'draft'),
  ('c0000000-0000-4000-a000-000000000004', 'b0000000-0000-4000-a000-000000000002',
   (select id from public.categories where slug = 'maison'),
   'Ventilateur sur pied', null, 275000, true, false, 'draft'),
  ('c0000000-0000-4000-a000-000000000005', 'b0000000-0000-4000-a000-000000000001',
   (select id from public.categories where slug = 'alimentation'),
   'Sucre en poudre 25 kg', null, 210000, false, false, 'draft'),
  -- Celui-ci reste en brouillon : il sert à vérifier, en naviguant, qu'un
  -- brouillon n'apparaît JAMAIS dans le fil public.
  ('c0000000-0000-4000-a000-000000000009', 'b0000000-0000-4000-a000-000000000001',
   (select id from public.categories where slug = 'beaute'),
   'Savon de Marseille x12 (brouillon)', null, 48000, false, false, 'draft')
on conflict (id) do nothing;


-- --- 4. Les photos --------------------------------------------------------
-- ATTENTION — CES LIGNES NE DÉSIGNENT AUCUN FICHIER RÉEL.
-- Elles respectent la convention de nommage de 0004_storage.sql
-- (`{merchant_id}/{product_id}/{n}.webp`) et suffisent au trigger de
-- publication, mais aucun octet n'a été envoyé dans le stockage : les
-- vignettes s'afficheront donc cassées tant que de vraies photos n'auront
-- pas été déposées. C'est attendu, ce n'est pas un défaut du branchement.
-- Les vraies photos arriveront à l'étape 5 (envoi par le commerçant).
insert into public.product_images (product_id, storage_path, position)
select p.id, p.merchant_id || '/' || p.id || '/0.webp', 0
  from public.products p
 where p.id <> 'c0000000-0000-4000-a000-000000000009'
on conflict (product_id, position) do nothing;

-- Trois photos sur le riz, pour voir la galerie avec plusieurs vignettes.
insert into public.product_images (product_id, storage_path, position)
select p.id, p.merchant_id || '/' || p.id || '/' || n || '.webp', n
  from public.products p, generate_series(1, 2) n
 where p.id = 'c0000000-0000-4000-a000-000000000001'
on conflict (product_id, position) do nothing;


-- --- 5. Publication -------------------------------------------------------
update public.products set status = 'active'
 where id <> 'c0000000-0000-4000-a000-000000000009';

-- Un produit vendu : la fiche barrée et la pastille « VENDU » ne se
-- vérifient pas autrement.
update public.products set status = 'sold'
 where id = 'c0000000-0000-4000-a000-000000000003';


-- =====================================================================
-- NETTOYAGE — à exécuter avant le lancement
-- =====================================================================
-- Les `on delete cascade` de 0001 font le reste : profils, boutiques,
-- produits, photos et conversations partent avec les comptes.
--
--   delete from auth.users where email like '%@demo.filloo.local';
--
-- =====================================================================
