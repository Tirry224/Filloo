# Savoir de veilleur-prod

Mémoire de l'agent `veilleur-prod`. État ACTUEL ; l'historique est dans
`git log`. Chaque entrée : date, source, constaté ou supposé. Jamais de
donnée personnelle ici.

## Où regarder

- **Supabase** : projet `bfmsruzyrgbndbueikcb` (`eu-west-3`), offre
  gratuite.
- **Vercel** : projet `prj_eAGRfpFJ0li6POY2tqq000aGOU6F`, équipe
  `team_SrOwsLKR3AcKEkWzQzFsuO6c` (« tiirry »), offre Hobby *supposée*.
  Fonctions à Paris (`cdg1`) : un déploiement en `iad1` est une
  régression. Production sur `filloo.net` (`main`) ; la préversion de
  `dev` utilise la MÊME base.
- **Sentry** : erreurs du serveur du site seulement.
- **Variables** (constaté 2026-10-15) : `VAPID_PRIVATE_KEY`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SENTRY_DSN`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `OWNER_EMAIL`,
  `NEXT_PUBLIC_SITE_URL`, en Production ET Preview.
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` de Vercel gagne sur `.env` au build :
  changer la clé, c'est changer les deux puis redéployer.
- **Cron** : `/api/quotidien`, 07:00 UTC (`vercel.json`).
- **Surveillance hebdomadaire** (2026-10-23) : tâche planifiée
  `trig_015DkshW2gbcjy1WPZ4DebYM`, lundi 07:58 heure de Conakry, lecture
  seule, alerte à 50 % d'une limite gratuite. **Créée sans connecteurs
  Supabase ni Vercel** (l'environnement ne permettait pas de les
  rattacher) : tant que le porteur du projet ne les a pas ajoutés sur
  claude.ai, elle signale une panne au lieu de mesurer.

## Dernières mesures

- **2026-10-23** : production = `d332da1` (READY). 40 migrations sur 40
  appliquées.
- **2026-10-22** : 5 boutiques, 2 produits, 6 photos, 17 messages ; base
  15 Mo, fichiers 0,76 Mo (8 objets, photo moyenne 95 Ko). Projection :
  ~10 000 photos, soit ~3 000 produits, avant la limite de 1 Go.
- **2026-10-15** : 1 abonnement web et 1 téléphone de l'app servis le
  jour même ; 0 photo orpheline ; 0 notification en attente.

## Problèmes connus (ne pas re-signaler comme nouveaux)

- **Action GitHub `Migrations` rouge chaque matin** : secret
  `SUPABASE_ACCESS_TOKEN` absent (2026-10-20), aucune comparaison faite.
- **Aucune sauvegarde de la base** (offre gratuite).
- **Alertes Supabase du 2026-10-14** : 15 fonctions `SECURITY DEFINER`
  ouvertes à `anon`, protection des mots de passe fuités désactivée
  (détail : `.claude/savoir/gardien-base.md`).
- **Signe de panne des notifications** : un `last_used_at`
  (`push_subscriptions`, `expo_push_tokens`) qui cesse d'avancer alors
  que des messages arrivent.

## Motifs appris

- (vide — à remplir au fil des bilans : erreurs récurrentes bénignes,
  signatures de vraies pannes.)
