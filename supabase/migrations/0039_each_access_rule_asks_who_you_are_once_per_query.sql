-- =====================================================================
-- 0039 — Chaque règle d'accès demande « qui es-tu ? » une fois par requête
-- =====================================================================
-- Ce que la base garantit après : les mêmes lignes visibles et
-- modifiables qu'avant, pour les mêmes personnes — mais l'identité de
-- celui qui demande (`my_profile_id`, `my_merchant_id`) n'est plus
-- recalculée à CHAQUE ligne lue.
--
-- 1. POURQUOI. `my_profile_id()` et `my_merchant_id()` sont `security
--    definer` : Postgres ne les « déplie » jamais dans la requête, il les
--    appelle à chaque ligne, et chaque appel relit `profiles` (et
--    `merchants`). Lire 500 produits, c'est 500 fois la même question.
--    Écrites `(select public.my_merchant_id())`, elles deviennent un
--    InitPlan : évaluées une fois, le résultat réutilisé partout.
--    0006 pensait le contraire (« auth.uid() est déjà à l'intérieur d'une
--    fonction stable ») : c'est faux pour une fonction `security definer`,
--    et l'alerte `auth_rls_initplan` de Supabase ne le voit pas, parce
--    qu'elle ne cherche que `auth.uid()` écrit en toutes lettres.
--
-- 2. CE QUI EST ENVELOPPÉ, ET SEULEMENT ÇA : les appels qui ne dépendent
--    pas de la ligne. `owns_profile(sender_id)`, `is_active_profile
--    (client_id)`, `merchant_is_public(merchant_id)`,
--    `i_talk_with_merchant(id)`, `conversation_is_open(conversation_id)`
--    prennent une colonne de la ligne : ils restent tels quels. Les
--    policies `messages: envoi par les participants` et
--    `reports: …` n'appellent que ce genre de fonctions : inchangées.
--    Celles qui écrivent déjà `(select auth.uid())` (0006, 0023, 0035,
--    0038) aussi.
--
-- 3. `alter policy` plutôt que `drop` + `create` : nom, commande, rôles
--    et caractère permissif restent EXACTEMENT ceux d'aujourd'hui ; seule
--    l'expression change. Chaque expression ci-dessous recopie celle de
--    `pg_policies` en production (lue le 2026-10-14), à l'enveloppe près.
--
-- 4. PRODUITS ET PHOTOS DE PRODUITS : la policy « je gère » était
--    `for all`, donc AUSSI une policy de lecture, doublon de « catalogue
--    public » / « visibles avec le produit » (alerte
--    `multiple_permissive_policies`). Elle devient trois policies
--    (insert, update, delete) aux expressions identiques. La lecture n'y
--    perd rien : ce que « je gère » laissait lire (mes produits, ET mon
--    compte actif) est inclus dans la branche « ou c'est ma boutique »
--    de la policy de lecture, qui reste seule.
--    `profiles` garde ses deux policies de lecture (mes profils / mes
--    interlocuteurs) : les fusionner en un OR serait sûr, mais 0006 les a
--    voulues séparées pour la lisibilité, et la mesure ne le justifie pas.
--
-- 5. DEUX INDEX sur des clés étrangères qui n'en avaient pas : sans eux,
--    supprimer un profil parcourt `notifications` et `profiles` en
--    entier pour vérifier les références.
--
-- Indépendante de 0036 à 0038 : aucune ne touche ces policies.
-- Compatibilité de l'app installée : les noms de policies ne sont lus
-- par aucun client ; les lignes visibles ne changent pas.

-- ---------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------
alter policy "conversations: reservees aux participants" on public.conversations
  using (
    client_id = (select public.my_profile_id('client'))
    or merchant_id = (select public.my_merchant_id())
  );

alter policy "conversations: un client contacte un commercant" on public.conversations
  with check (
    client_id = (select public.my_profile_id('client'))
    and public.is_active_profile(client_id)
    and public.merchant_is_public(merchant_id)
    and ((select public.my_merchant_id()) is null
         or merchant_id <> (select public.my_merchant_id()))
  );

alter policy "conversations: je bloque ou débloque mon interlocuteur" on public.conversations
  using (
    (client_id = (select public.my_profile_id('client'))
      and (blocked_by is null or blocked_by = client_id))
    or (merchant_id = (select public.my_merchant_id())
      and (blocked_by is null
           or blocked_by = (select m.profile_id from public.merchants m
                             where m.id = conversations.merchant_id)))
  )
  with check (
    (client_id = (select public.my_profile_id('client'))
      and (blocked_by is null or blocked_by = client_id))
    or (merchant_id = (select public.my_merchant_id())
      and (blocked_by is null
           or blocked_by = (select m.profile_id from public.merchants m
                             where m.id = conversations.merchant_id)))
  );

-- ---------------------------------------------------------------------
-- merchants
-- ---------------------------------------------------------------------
alter policy "merchants: boutiques approuvees publiques" on public.merchants
  using (
    public.merchant_is_public(id)
    or profile_id = (select public.my_profile_id('merchant'))
    or public.i_talk_with_merchant(id)
  );

alter policy "merchants: je cree ma boutique" on public.merchants
  with check (
    profile_id = (select public.my_profile_id('merchant'))
    and public.is_active_profile(profile_id)
  );

alter policy "merchants: je modifie ma boutique" on public.merchants
  using (
    profile_id = (select public.my_profile_id('merchant'))
    and public.is_active_profile(profile_id)
  )
  with check (profile_id = (select public.my_profile_id('merchant')));

-- ---------------------------------------------------------------------
-- messages (« envoi par les participants » : rien qui ne dépende pas de
-- la ligne, inchangée)
-- ---------------------------------------------------------------------
alter policy "messages: lecture par les participants" on public.messages
  using (
    exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.client_id = (select public.my_profile_id('client'))
              or c.merchant_id = (select public.my_merchant_id()))
    )
  );

alter policy "messages: marquer comme lu" on public.messages
  using (
    not public.owns_profile(sender_id)
    and exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.client_id = (select public.my_profile_id('client'))
              or c.merchant_id = (select public.my_merchant_id()))
    )
  )
  with check (true);

-- ---------------------------------------------------------------------
-- profiles (les trois policies de 0006 écrivent déjà `(select auth.uid())`)
-- ---------------------------------------------------------------------
alter policy "profiles: je vois mes interlocuteurs" on public.profiles
  using (
    exists (
      select 1
        from public.conversations c
        join public.merchants m on m.id = c.merchant_id
       where (c.client_id = profiles.id
              and m.profile_id = (select public.my_profile_id('merchant')))
          or (m.profile_id = profiles.id
              and c.client_id = (select public.my_profile_id('client')))
    )
  );

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
alter policy "products: catalogue public" on public.products
  using (
    (status in ('active', 'sold') and public.merchant_is_public(merchant_id))
    or merchant_id = (select public.my_merchant_id())
  );

-- « je gere mes produits » (for all) → trois policies d'écriture, même
-- expression. La lecture de mes produits passe par « catalogue public ».
drop policy "products: je gere mes produits" on public.products;

create policy "products: je cree mes produits"
  on public.products for insert
  with check (
    merchant_id = (select public.my_merchant_id())
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );

create policy "products: je modifie mes produits"
  on public.products for update
  using (
    merchant_id = (select public.my_merchant_id())
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  )
  with check (
    merchant_id = (select public.my_merchant_id())
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );

create policy "products: je retire mes produits"
  on public.products for delete
  using (
    merchant_id = (select public.my_merchant_id())
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );

-- ---------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------
alter policy "product_images: visibles avec le produit" on public.product_images
  using (
    exists (
      select 1 from public.products p
       where p.id = product_images.product_id
         and ((p.status in ('active', 'sold')
               and exists (select 1 from public.merchants m
                            where m.id = p.merchant_id and m.status = 'approved'))
              or p.merchant_id = (select public.my_merchant_id()))
    )
  );

drop policy "product_images: je gere les photos de mes produits" on public.product_images;

create policy "product_images: j'ajoute les photos de mes produits"
  on public.product_images for insert
  with check (
    exists (select 1 from public.products p
             where p.id = product_images.product_id
               and p.merchant_id = (select public.my_merchant_id()))
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );

create policy "product_images: je modifie les photos de mes produits"
  on public.product_images for update
  using (
    exists (select 1 from public.products p
             where p.id = product_images.product_id
               and p.merchant_id = (select public.my_merchant_id()))
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  )
  with check (
    exists (select 1 from public.products p
             where p.id = product_images.product_id
               and p.merchant_id = (select public.my_merchant_id()))
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );

create policy "product_images: je retire les photos de mes produits"
  on public.product_images for delete
  using (
    exists (select 1 from public.products p
             where p.id = product_images.product_id
               and p.merchant_id = (select public.my_merchant_id()))
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );

-- ---------------------------------------------------------------------
-- Stockage (0004, 0029) : le dossier de ma boutique
-- ---------------------------------------------------------------------
alter policy "photos: envoi dans mon dossier" on storage.objects
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
  );
alter policy "photos: remplacement dans mon dossier" on storage.objects
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
  );
alter policy "photos: suppression dans mon dossier" on storage.objects
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
  );

alter policy "photos boutique: envoi dans mon dossier" on storage.objects
  with check (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
  );
alter policy "photos boutique: remplacement dans mon dossier" on storage.objects
  using (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
  );
alter policy "photos boutique: suppression dans mon dossier" on storage.objects
  using (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
  );

-- ---------------------------------------------------------------------
-- Index des clés étrangères (alerte `unindexed_foreign_keys`)
-- ---------------------------------------------------------------------
create index if not exists notifications_profile_idx on public.notifications (profile_id);
create index if not exists profiles_city_idx        on public.profiles (city_id);
