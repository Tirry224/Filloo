-- =====================================================================
-- 0031 — Une photo de boutique envoyée depuis un iPhone passe
-- =====================================================================
-- Constat du 2026-09-25 : sur iPhone, chaque envoi de photo de boutique
-- échouait. Les journaux du stockage disaient pourquoi :
-- « mime type image/png is not supported ».
--
-- Safari ne sait pas ENCODER le WebP dans un canvas. Quand
-- `browser-image-compression` lui demande du WebP, il rend du PNG sans
-- rien dire ; le bucket de 0029, limité à `image/webp`, le refusait.
--
-- `ShopPhotoPicker` retombe désormais sur le JPEG — que tous les
-- navigateurs encodent — quand le WebP n'est pas sorti. Le bucket doit
-- donc l'accepter. Le PNG reste refusé : à 512 px il pèse plusieurs fois
-- un JPEG, et l'application n'en produit plus.

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'shop-photos';
