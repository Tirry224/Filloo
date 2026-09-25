-- =====================================================================
-- 0029 — Une boutique a une photo de profil
-- =====================================================================
-- Demande du porteur du projet, 2026-09-25 : jusqu'ici chaque boutique
-- s'affichait derrière la même icône de colis, et un client ne
-- distinguait « Chez Aïssatou » de « Boutique Madina » que par le nom.
--
-- 1. LA COLONNE. `merchants.photo_path`, facultative : une boutique sans
--    photo garde l'icône actuelle. On stocke le CHEMIN, comme pour les
--    produits (0004), jamais l'image.
--
-- 2. UN BUCKET À PART, `shop-photos`, et pas un dossier de
--    `product-images`. Raison qui a tranché : le ménage de 0028
--    (`photos_orphelines`) efface tout fichier de `product-images` que
--    `product_images` ne cite pas. Une photo de boutique posée là serait
--    effacée au bout de 24 heures, sans erreur. Un bucket séparé permet
--    aussi de le borner (taille, format) sans toucher aux photos de
--    produits.
--
-- 3. LA CONTRAINTE sur le chemin. Le RLS du stockage empêche d'ÉCRIRE
--    dans le dossier d'une autre boutique, mais rien n'empêchait de
--    RÉFÉRENCER le fichier d'une autre : `photo_path` pointant vers la
--    photo d'un concurrent. Le chemin doit donc commencer par l'id de la
--    boutique elle-même.

alter table public.merchants
  add column photo_path text;

alter table public.merchants
  add constraint merchants_photo_path_dans_son_dossier check (
    photo_path is null
    or (
      photo_path like id::text || '/%'
      and photo_path not like '%..%'
      and length(photo_path) <= 200
    )
  );

comment on column public.merchants.photo_path is
  'Chemin de la photo de profil dans le bucket shop-photos : {merchant_id}/{fichier}. Null : icône par défaut.';

-- Liste blanche des colonnes (0002, partie 4) : sans cette ligne, le
-- commerçant ne pourrait pas écrire sa photo — et un `grant update` sur la
-- table entière rouvrirait `status`.
grant update (photo_path) on public.merchants to authenticated;


-- ---------------------------------------------------------------------
-- Stockage
-- ---------------------------------------------------------------------
-- 1 Mo et WebP seulement : le navigateur compresse avant l'envoi
-- (`ShopPhotoPicker`), un fichier plus lourd ou d'un autre format ne vient
-- donc pas de l'application.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-photos', 'shop-photos', true, 1048576, array['image/webp'])
on conflict (id) do nothing;

create policy "photos boutique: lecture publique"
  on storage.objects for select
  using (bucket_id = 'shop-photos');

-- Même convention que les produits : premier dossier = ma boutique.
create policy "photos boutique: envoi dans mon dossier"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = public.my_merchant_id()::text
  );

create policy "photos boutique: remplacement dans mon dossier"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = public.my_merchant_id()::text
  );

create policy "photos boutique: suppression dans mon dossier"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = public.my_merchant_id()::text
  );
