-- =====================================================================
-- 0023 : un téléphone peut être joint quand l'application est fermée
-- =====================================================================
-- L'email prévient déjà d'un nouveau message (`src/lib/notifications.ts`).
-- Il a un défaut que rien ne corrigera : personne ne relève sa boîte
-- toutes les dix minutes, et un commerçant qui répond quatre heures après
-- a perdu le client. La notification push arrive sur l'écran verrouillé,
-- application fermée. C'est la seule façon d'être lu tout de suite.
--
-- CETTE TABLE NE PORTE PAS DES PERSONNES, MAIS DES TÉLÉPHONES
-- Une même personne a un téléphone et parfois un ordinateur ; le même
-- téléphone peut servir à deux comptes. Ce qui s'abonne, c'est un
-- NAVIGATEUR sur un APPAREIL — identifié par son `endpoint`, une URL que
-- le service de push (Google, Apple, Mozilla) fabrique et qui ne
-- ressemble à rien d'autre. D'où la clé unique sur cette colonne : un
-- même appareil qui se réabonne remplace sa ligne au lieu d'en créer une
-- deuxième, sinon la personne recevrait deux notifications identiques.
--
-- POURQUOI `auth_user_id` ET NON `profile_id`
-- Une connexion peut porter DEUX profils — client et commerçant (voir
-- `unique (auth_user_id, role)` en 0001). Le téléphone, lui, est le même
-- dans les deux cas, et le mot de passe aussi. Rattacher l'abonnement au
-- profil obligerait à en créer deux pour un seul appareil, puis à en
-- envoyer deux notifications pour un seul message. L'envoi résout le
-- profil destinataire vers son `auth_user_id`, et s'arrête là.
--
-- CE QUE CETTE TABLE CONTIENT DE SENSIBLE
-- Les trois valeurs (`endpoint`, `p256dh`, `auth_secret`) forment, prises
-- ensemble, le droit d'écrire sur l'écran verrouillé de quelqu'un.
-- Quiconque les obtient peut lui envoyer une notification qui portera le
-- nom de Makiti. Elles ne sortent donc JAMAIS vers un écran : seules les
-- actions serveur les lisent, et le RLS ci-dessous interdit à chacun de
-- voir autre chose que ses propres appareils.

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  -- `on delete cascade` : un compte supprimé emporte ses abonnements.
  -- C'est l'un des rares cas où la suppression franche est la bonne —
  -- contrairement aux profils, anonymisés pour ne pas trouer les
  -- conversations, un abonnement mort ne laisse rien à lire à personne.
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  -- L'adresse à laquelle POSTer pour joindre cet appareil. Unique :
  -- c'est l'identité de l'appareil, pas une donnée parmi d'autres.
  endpoint     text not null unique,
  -- Les deux clés du chiffrement de bout en bout (standard Web Push) :
  -- le service de push transporte sans pouvoir lire.
  p256dh       text not null,
  auth_secret  text not null,
  -- Pour savoir, en cas de plainte, DE QUEL appareil on parle. Purement
  -- descriptif, jamais lu par le code d'envoi.
  user_agent   text,
  created_at   timestamptz not null default now(),
  -- Renseigné à chaque envoi réussi. Sert à repérer les abonnements que
  -- plus personne n'utilise, sans les supprimer à l'aveugle.
  last_used_at timestamptz
);

-- L'envoi part TOUJOURS d'une personne à joindre : « tous les appareils
-- de cet utilisateur ». C'est la seule lecture que fait le code.
create index push_subscriptions_user_idx
  on public.push_subscriptions (auth_user_id);

comment on table public.push_subscriptions is
  'Un appareil abonné aux notifications push, identifié par son endpoint. Lu par l''envoi côté serveur ; jamais affiché à personne.';


-- ---------------------------------------------------------------------
-- RLS : chacun ne voit et ne gère QUE ses propres appareils
-- ---------------------------------------------------------------------
-- Rappel de la leçon payée en 0002 : le RLS filtre des LIGNES, jamais des
-- colonnes. Ici les deux questions se confondent — une ligne qu'on n'a
-- pas le droit de voir ne livre aucune de ses colonnes — mais le droit
-- d'écriture, lui, demande sa propre attention : sans `with check`, on
-- pourrait insérer une ligne au nom de quelqu'un d'autre et détourner ses
-- notifications.

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: je vois mes appareils"
  on public.push_subscriptions for select
  using (auth_user_id = (select auth.uid()));

-- `with check` et non `using` : à l'insertion, la ligne n'existe pas
-- encore, il n'y a donc rien à filtrer — il y a une ligne PROPOSÉE à
-- valider. Confondre les deux est l'erreur qui laisse écrire au nom des
-- autres.
create policy "push_subscriptions: j''abonne mon appareil"
  on public.push_subscriptions for insert
  with check (auth_user_id = (select auth.uid()));

-- Le réabonnement (`pushsubscriptionchange` dans `public/sw.js`) met à
-- jour les clés d'un endpoint existant. Les deux clauses sont
-- nécessaires : `using` dit quelles lignes on peut toucher, `with check`
-- ce qu'elles ont le droit de devenir — sans la seconde, on pourrait
-- transférer son propre abonnement à quelqu'un d'autre.
create policy "push_subscriptions: je mets a jour mon appareil"
  on public.push_subscriptions for update
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy "push_subscriptions: je desabonne mon appareil"
  on public.push_subscriptions for delete
  using (auth_user_id = (select auth.uid()));
