-- =====================================================================
-- 0040 — Le dossier des photos produits n'accepte que des images raisonnables
-- =====================================================================
-- Ce que la base garantit après : le bucket `product-images` refuse tout
-- fichier de plus de 1 Mo, et tout fichier qui n'est ni du WebP ni du
-- JPEG. Jusqu'ici (0004) il acceptait n'importe quoi, de n'importe quelle
-- taille : une vidéo de 40 Mo déposée par un commerçant aurait été servie
-- publiquement, sur l'offre gratuite (1 Go de stockage, 5 Go de trafic).
--
-- Ce que les clients envoient réellement (lu le 2026-10-14) :
--   - le site (`PhotoPicker` → `compresserPhoto`, src/lib/compression.ts) :
--     WebP, ou JPEG quand le navigateur n'encode pas le WebP (Safari,
--     voir 0031) ; `maxSizeMB: 0.5`, 1 280 px au plus grand côté ;
--     `contentType` = le type réel du fichier compressé ;
--   - l'app (`envoyerPhoto`, filloo-mobile src/lib/edition-produit.ts) :
--     toujours `image/jpeg`, 1 280 px, qualité 0,7, depuis sa première
--     version (6d5a6a9) ;
--   - mesuré : 2 920 Ko → 185 Ko pour une photo de téléphone
--     (docs/PERFORMANCE.md, R1).
-- 1 Mo laisse donc au moins le double de marge sur le pire cas du site,
-- et environ trois fois la taille habituelle d'un JPEG de l'app. Même
-- limite que `shop-photos` (0029, 0031).
--
-- Photos déjà stockées : 1 seule au 2026-10-14, WebP, 6,9 Ko — conforme.
-- Une limite de bucket ne touche d'ailleurs que les ENVOIS suivants.
--
-- C'est le service Storage qui applique la limite, à l'envoi : Postgres
-- ne fait que la porter. Un envoi refusé répond 413 (taille) ou 415
-- (type), que le site et l'app affichent comme un envoi échoué.

update storage.buckets
set file_size_limit    = 1048576,
    allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'product-images';
