import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";

/**
 * Index des écrans — page de TRAVAIL, pas de produit.
 *
 * Elle existe parce qu'il n'y a pas encore d'authentification : rien ne
 * dit si l'on est client ou commerçant, et plusieurs écrans (boutique
 * refusée, compte suspendu, hors ligne) ne s'atteignent pas en naviguant
 * normalement. Cette page les rend tous accessibles pour relecture.
 *
 * À SUPPRIMER quand la session existera. Une page de débogage qu'on oublie
 * de retirer finit toujours par être trouvée par un utilisateur.
 */

/**
 * Identifiants RÉELS lus en base, jamais codés en dur.
 *
 * Neuf liens de cette page pointaient sur `p-riz`, `p-huile`,
 * `m-aissatou`, `t-mariama` — les identifiants de l'ancien `src/lib/mock.ts`.
 * Ils étaient donc morts depuis que l'application lit la vraie base : le
 * jeu de démonstration créait des UUID (`c0000000-…`), pas ces noms. Un
 * index d'écrans dont un tiers des liens mène à « Cette page n'existe
 * pas » ne sert pas à relire les écrans, il fait croire que
 * l'application est cassée.
 *
 * Quand un enregistrement manque (base vide, aucun fil de discussion
 * encore créé), la ligne dit QUOI faire pour l'obtenir au lieu d'offrir
 * un lien qui échoue. C'est l'état normal d'une base neuve, pas une
 * erreur.
 */
type ScreenIds = {
  produit?: string;
  produitVendu?: string;
  boutique?: string;
  conversation?: string;
};

function screenGroups(ids: ScreenIds): {
  title: string;
  /* [numéro, intitulé, lien?, ce qui manque pour l'obtenir?] */
  screens: [string, string, string?, string?][];
}[] {
  const MANQUE_PRODUIT = "publiez un produit";
  const MANQUE_VENDU = "marquez un produit vendu";
  const MANQUE_BOUTIQUE = "créez une boutique validée";
  const MANQUE_FIL = "écrivez à un vendeur";

  return [
    {
      title: "Client",
      screens: [
        ["1", "Fil d'accueil", "/"],
        ["2", "Fil — ville sans produit", "/?ville=Boké"],
        ["3", "Fil — chargement", undefined],
        ["4", "Fil — hors ligne", undefined],
        ["5", "Recherche", "/recherche?q=telephone"],
        ["6", "Recherche — aucun résultat", "/recherche?q=frigo"],
        ["7", "Fiche produit", ids.produit && `/produit/${ids.produit}`, MANQUE_PRODUIT],
        ["8", "Fiche produit — vendu", ids.produitVendu && `/produit/${ids.produitVendu}`, MANQUE_VENDU],
        ["9", "Galerie photo", ids.produit && `/produit/${ids.produit}/photos`, MANQUE_PRODUIT],
        ["10", "Signaler un produit", ids.produit && `/produit/${ids.produit}/signaler`, MANQUE_PRODUIT],
        ["11", "Boutique publique", ids.boutique && `/boutique/${ids.boutique}`, MANQUE_BOUTIQUE],
      ],
    },
    {
      title: "Compte & accès",
      screens: [
        ["12", "Inscription — choix du rôle", "/inscription"],
        ["13", "Inscription — ma boutique", "/inscription/boutique"],
        ["14", "Connexion", "/connexion"],
        ["15", "Mot de passe oublié", "/mot-de-passe-oublie"],
        ["16", "Compte requis", ids.produit && `/produit/${ids.produit}/contacter`, MANQUE_PRODUIT],
        ["17", "Mon compte", "/compte"],
        ["18", "Mes informations", "/compte/informations"],
        ["19", "Compte suspendu", "/compte/suspendu"],
      ],
    },
    {
      title: "Commerçant",
      screens: [
        ["20", "Boutique en attente", "/vendeur/attente"],
        ["21", "Boutique refusée", "/vendeur/refusee"],
        ["22", "Mes produits", "/vendeur"],
        ["23", "Mes produits — vide", "/vendeur?etat=vide"],
        ["24", "Ajouter un produit", "/vendeur/produits/nouveau"],
        ["25", "Actions produit", ids.produit && `/vendeur/produits/${ids.produit}/actions`, MANQUE_PRODUIT],
        ["26", "Modifier ma boutique", "/vendeur/boutique"],
      ],
    },
    {
      title: "Messagerie",
      screens: [
        /* Deux adresses, plus deux vues d'une seule. `?vue=` n'existe
           plus : la messagerie du commerçant vit sous `/vendeur`, celle
           du client à la racine. L'écran 29 (« vide ») n'a plus d'URL
           propre — il n'en a jamais eu une vraie : c'était l'état des
           deux autres quand la liste est vide, pas un troisième écran. */
        ["27", "Messages — commerçant", "/vendeur/messages"],
        ["28", "Messages — client", "/messages"],
        ["30", "Fil de discussion", ids.conversation && `/messages/${ids.conversation}`, MANQUE_FIL],
        ["31", "Citer un produit", ids.conversation && `/messages/${ids.conversation}/citer`, MANQUE_FIL],
        ["32", "Actions conversation", ids.conversation && `/messages/${ids.conversation}/actions`, MANQUE_FIL],
        ["32b", "Signaler une conversation", ids.conversation && `/messages/${ids.conversation}/signaler`, MANQUE_FIL],
      ],
    },
    {
      title: "Transverse",
      screens: [
        ["33", "Page introuvable", "/adresse-qui-nexiste-pas"],
        ["—", "Design system", "/styleguide"],
      ],
    },
  ];
}

/* Rendu à la requête, pas au build : sans ça, le résultat de `notFound()`
   était figé dans une page statique mise en cache, et la garde
   `NODE_ENV` n'était plus qu'un souvenir du build.

   Ce que ce réglage ne corrige PAS, vérifié au `curl` et non supposé : la
   réponse reste un **200** portant le contenu « Cette page n'existe
   pas », pas un vrai 404. C'est documenté et attendu en Next 16
   (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`,
   section « Calling notFound() after streaming has started ») : le
   `loading.tsx` de la racine ouvre une frontière `<Suspense>` sur chaque
   route, donc la réponse a commencé à partir avant que la garde ne soit
   évaluée — et un statut ne se change plus une fois le flux ouvert.

   Ce que Next fait à la place, et qui suffit ici : il injecte
   `<meta name="robots" content="noindex">`, vérifié présent sur cette
   adresse et absent des pages légitimes. Le risque réel — une page de
   travail interne trouvée par un moteur de recherche — est donc fermé.

   Pour un vrai 404, il faudrait déplacer la garde dans `proxy` (le
   remplaçant de `middleware`, cf. l'avertissement de dépréciation au
   build), qui s'exécute AVANT le flux. À faire avec cette migration, pas
   au milieu d'une correction de bugs. */
export const dynamic = "force-dynamic";

/**
 * Page de TRAVAIL : accessible en développement, introuvable en
 * production.
 *
 * `README` et `docs/REPRISE.md` prévoyaient de la supprimer « quand
 * l'authentification existera » — c'est chose faite depuis le
 * 2026-09-11, et pourtant le build la prérendait toujours (`○ /ecrans`),
 * donc elle partait en ligne, ouverte à tous.
 *
 * La supprimer maintenant serait quand même une erreur : l'étape 1 de
 * `docs/REPRISE.md` — ouvrir les 33 écrans dans un navigateur, la
 * première chose qui reste à faire sur ce projet — se fait précisément
 * depuis ici. On ne jette pas l'outil la veille de s'en servir.
 *
 * D'où ce `notFound()` conditionnel plutôt qu'un `rm` : l'outil reste
 * entier en local, et l'adresse renvoie la page « Cette page n'existe
 * pas » en production, comme n'importe quelle URL inventée. Le test
 * s'évalue au build (`NODE_ENV` vaut alors `production`), donc rien n'est
 * décidé à chaud à chaque visite.
 *
 * À supprimer pour de bon quand l'étape 1 sera terminée.
 */
export default async function ScreensIndexPage() {
  if (process.env.NODE_ENV === "production") notFound();

  /* Quatre lectures indépendantes, lancées ensemble : aucune n'attend le
     résultat d'une autre. Les conversations ne remonteront que pour une
     session qui en a (le RLS s'en charge) — normal, pas une erreur. */
  const supabase = await createClient();
  const [produit, produitVendu, boutique, conversation] = await Promise.all([
    supabase.from("products").select("id").eq("status", "active").limit(1).maybeSingle(),
    supabase.from("products").select("id").eq("status", "sold").limit(1).maybeSingle(),
    supabase.from("merchants").select("id").eq("status", "approved").limit(1).maybeSingle(),
    supabase.from("conversations").select("id").limit(1).maybeSingle(),
  ]);

  const groups = screenGroups({
    produit: produit.data?.id,
    produitVendu: produitVendu.data?.id,
    boutique: boutique.data?.id,
    conversation: conversation.data?.id,
  });

  const liensManquants = groups
    .flatMap((g) => g.screens)
    .filter(([, , href, manque]) => !href && manque).length;

  return (
    <Screen>
      <TopBar title={<Wordmark />} right={<span className="text-sm text-ink-soft">33 écrans</span>} />

      <ScreenBody>
        <Section className="gap-2 pb-0">
          <p className="rounded-lg bg-warn-soft px-3.5 py-3 text-xs leading-normal text-warn-ink">
            Page de travail, à supprimer avant le lancement. Les écrans 3 et 4 n&apos;ont pas de
            lien : ils s&apos;affichent tout seuls, l&apos;un pendant le chargement des données,
            l&apos;autre quand celui-ci échoue.
            {liensManquants > 0 ? (
              <>
                {" "}
                <strong className="font-semibold">
                  {liensManquants} écran{liensManquants > 1 ? "s" : ""} sans lien
                </strong>{" "}
                : ils ont besoin d&apos;un enregistrement réel en base, et chaque ligne dit lequel.
                La base est neuve — créez une boutique et un produit, les liens apparaîtront.
              </>
            ) : null}
          </p>
        </Section>

        {groups.map((group) => (
          <Section key={group.title} className="gap-2">
            <SectionLabel>{group.title}</SectionLabel>
            <Card className="px-3.5">
              {group.screens.map(([number, label, href, manque]) => {
                const inner = (
                  <>
                    <span className="w-6 shrink-0 text-sm text-ink-soft tabular-nums">{number}</span>
                    <span className="flex-1 text-base">{label}</span>
                    {href ? (
                      <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
                    ) : (
                      /* Trois états, pas deux : un écran qui s'affiche tout
                         seul (« automatique ») et un écran qui attend une
                         vraie donnée ne se ressemblent pas. Dire lequel
                         manque évite de chercher un bug qui n'existe pas. */
                      <span className="shrink-0 text-2xs text-ink-soft">{manque ?? "automatique"}</span>
                    )}
                  </>
                );
                const className =
                  "flex h-tap items-center gap-3 border-b border-line last:border-b-0";
                return href ? (
                  <Link key={number + label} href={href} className={className}>
                    {inner}
                  </Link>
                ) : (
                  <div key={number + label} className={`${className} text-ink-soft`}>
                    {inner}
                  </div>
                );
              })}
            </Card>
          </Section>
        ))}
      </ScreenBody>
    </Screen>
  );
}
