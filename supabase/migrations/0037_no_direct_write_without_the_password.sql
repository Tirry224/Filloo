-- =====================================================================
-- 0037 — Plus d'écriture directe des informations protégées
-- =====================================================================
-- Ferme la faille décrite dans 0036 : une session seule ne peut plus
-- réécrire nom et téléphone d'un compte, ni les informations d'une
-- boutique. Ces écritures passent par `modifier_mes_informations` et
-- `modifier_ma_boutique`, que seul le serveur appelle, après avoir
-- vérifié le mot de passe.
--
-- À APPLIQUER APRÈS la nouvelle version de l'app : l'ancienne écrit ces
-- colonnes en direct, et ses enregistrements seraient refusés.
--
-- Révocation colonne par colonne : c'est ainsi que 0002 (partie 4), 0010
-- et 0029 les avaient accordées, sur une table dont l'UPDATE global est
-- déjà révoqué. Ce qui reste accordé :
--   - `profiles.city_id` (0010) : la ville du client, sans mot de passe ;
--   - rien sur `merchants` : tout le formulaire de la boutique est
--     derrière le mot de passe, sur le site comme dans l'app.

revoke update (full_name, phone) on public.profiles from authenticated, anon;

revoke update (shop_name, description, whatsapp_phone, city_id, address_hint, photo_path)
  on public.merchants from authenticated, anon;
