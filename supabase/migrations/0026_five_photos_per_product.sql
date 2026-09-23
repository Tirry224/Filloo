-- =====================================================================
-- 0026 — Cinq photos par produit
-- =====================================================================
-- Le maximum reste porté par la structure (voir 0001) : `position` va de
-- 0 à 4 et `unique (product_id, position)` interdit une sixième photo.
-- `PHOTOS_MAX` (src/lib/storage.ts) doit suivre cette borne.

alter table public.product_images
  drop constraint product_images_position_check,
  add constraint product_images_position_check check (position between 0 and 4);
