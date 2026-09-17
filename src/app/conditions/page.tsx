import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { safeNextPath } from "@/lib/next-param";

/**
 * Conditions d'utilisation — le TEXTE fourni par le porteur du projet le
 * 2026-09-17, reproduit tel quel.
 *
 * CE FICHIER NE RÉDIGE RIEN
 * Le contenu ci-dessous est recopié mot pour mot. Un document juridique
 * ne se reformule pas pour l'affichage : une phrase « améliorée » par une
 * session de code est une phrase que personne n'a validée, et qui engage
 * pourtant. Les seuls choix faits ici sont de MISE EN PAGE — hiérarchie
 * des titres, listes à puces, longueur de ligne.
 *
 * POURQUOI À LA RACINE, ET NON DANS UN ESPACE
 * Cette page est lisible sans compte et se rejoint depuis les DEUX
 * espaces : `/compte` côté client, `/vendeur/boutique` côté commerçant.
 * La ranger dans l'un des deux aurait fait traverser la frontière à
 * l'autre — exactement ce que la séparation des espaces interdit. Elle
 * vit donc à côté de `/connexion` : un écran qui n'appartient à personne.
 *
 * LA FLÈCHE RETOUR NE PEUT PAS ÊTRE FIGÉE
 * Deux points d'entrée, deux espaces. Un `backHref` en dur renverrait un
 * commerçant dans l'espace client, ou l'inverse. D'où `?retour=`, posé
 * par l'écran appelant et filtré par `safeNextPath` — le même garde-fou
 * que `?next=`, pour la même raison : un paramètre de redirection qui
 * accepte une URL absolue est une redirection ouverte.
 *
 * Ce paramètre ne ressemble QUE de loin au `?vue=` supprimé : il ne
 * décide pas de ce qui s'affiche — cette page est identique pour tout le
 * monde — il ne décide que d'où l'on revient. Une valeur absente ou
 * invalide ramène à l'accueil public, qui est la bonne réponse pour
 * quelqu'un arrivé par un lien direct.
 */

type Article = {
  titre: string;
  /** Paragraphes et listes dans l'ordre du document. */
  blocs: ({ type: "p"; texte: string } | { type: "liste"; points: string[] })[];
};

const MISE_A_JOUR = "17 septembre 2026";

const PREAMBULE = [
  "Les présentes Conditions d'utilisation (« Conditions ») régissent l'accès et l'utilisation de Makiti (« Makiti », « nous », « notre » ou « la plateforme »).",
  "En créant un compte ou en utilisant Makiti, vous reconnaissez avoir lu et accepté ces Conditions.",
];

const ARTICLES: Article[] = [
  {
    titre: "1. Objet de Makiti",
    blocs: [
      {
        type: "p",
        texte:
          "Makiti est une plateforme de mise en relation permettant aux commerçants de présenter leurs produits et aux clients de les découvrir et de contacter les commerçants.",
      },
      { type: "p", texte: "Makiti permet notamment :" },
      {
        type: "liste",
        points: [
          "la consultation du catalogue sans création de compte ;",
          "la recherche de produits et de boutiques ;",
          "le filtrage par ville et catégorie ;",
          "la création et la gestion d'une boutique ;",
          "la publication de produits ;",
          "la messagerie entre clients et commerçants ;",
          "le signalement de contenus ou de comportements problématiques.",
        ],
      },
      {
        type: "p",
        texte:
          "Makiti n'est pas le vendeur des produits présents sur la plateforme et n'est pas partie aux transactions entre utilisateurs.",
      },
    ],
  },
  {
    titre: "2. Transactions entre utilisateurs",
    blocs: [
      { type: "p", texte: "Makiti ne fournit actuellement :" },
      {
        type: "liste",
        points: [
          "aucun paiement en ligne ;",
          "aucun panier ;",
          "aucun service de livraison ;",
          "aucune gestion de stock ;",
          "aucun système de notation ou d'avis.",
        ],
      },
      {
        type: "p",
        texte:
          "Le prix, le paiement, la livraison ou remise du produit et les autres conditions de vente sont convenus directement entre le client et le commerçant.",
      },
      {
        type: "p",
        texte:
          "Makiti ne garantit donc pas qu'une transaction aura lieu ni qu'elle sera correctement exécutée.",
      },
      {
        type: "p",
        texte: "Le client doit effectuer les vérifications qu'il juge nécessaires avant toute transaction.",
      },
    ],
  },
  {
    titre: "3. Conditions d'accès",
    blocs: [
      { type: "p", texte: "La consultation du catalogue est accessible sans compte." },
      {
        type: "p",
        texte:
          "Un compte est nécessaire pour utiliser certaines fonctionnalités, notamment la messagerie.",
      },
      {
        type: "p",
        texte: "L'utilisateur doit fournir des informations exactes et à jour lors de son inscription.",
      },
      {
        type: "p",
        texte:
          "Le numéro de téléphone est demandé pour le compte mais n'est pas vérifié par SMS dans la version actuelle de Makiti. L'utilisateur reste responsable de l'exactitude du numéro fourni.",
      },
    ],
  },
  {
    titre: "4. Compte client et compte commerçant",
    blocs: [
      {
        type: "p",
        texte:
          "Une même personne peut disposer d'un compte client et d'un compte commerçant liés à une même connexion.",
      },
      { type: "p", texte: "Ces deux espaces restent séparés :" },
      {
        type: "liste",
        points: [
          "les données client appartiennent à l'espace client ;",
          "les données de boutique appartiennent à l'espace commerçant ;",
          "les historiques et actions de chaque espace restent séparés ;",
          "une suspension du compte client ne signifie pas automatiquement la suspension de la boutique, et inversement.",
        ],
      },
      {
        type: "p",
        texte:
          "L'utilisateur ne doit pas tenter de contourner une suspension en utilisant un autre compte ou espace.",
      },
    ],
  },
  {
    titre: "5. Compte commerçant et validation",
    blocs: [
      {
        type: "p",
        texte:
          "La création d'un espace commerçant ne signifie pas que la boutique est automatiquement approuvée.",
      },
      { type: "p", texte: "Makiti peut effectuer un contrôle avant l'activation de la boutique." },
      {
        type: "p",
        texte:
          "Un commerçant en attente de validation peut préparer sa boutique et ses produits en brouillon.",
      },
      { type: "p", texte: "Makiti peut :" },
      {
        type: "liste",
        points: [
          "approuver une boutique ;",
          "demander des corrections ou informations complémentaires ;",
          "refuser une boutique ;",
          "suspendre une boutique précédemment approuvée.",
        ],
      },
      {
        type: "p",
        texte:
          "La validation d'une boutique ne constitue pas une certification, une garantie de solvabilité ou une garantie concernant les produits du commerçant.",
      },
    ],
  },
  {
    titre: "6. Responsabilité des commerçants",
    blocs: [
      { type: "p", texte: "Le commerçant est seul responsable des informations qu'il publie, notamment :" },
      {
        type: "liste",
        points: [
          "nom de la boutique ;",
          "ville ;",
          "numéro de téléphone ;",
          "coordonnées WhatsApp lorsqu'elles sont fournies ;",
          "prix ;",
          "description ;",
          "photos ;",
          "disponibilité du produit.",
        ],
      },
      {
        type: "p",
        texte: "Le commerçant doit maintenir ces informations aussi exactes et à jour que possible.",
      },
      {
        type: "p",
        texte:
          "Il ne doit pas publier volontairement des informations fausses, trompeuses ou destinées à induire un client en erreur.",
      },
    ],
  },
  {
    titre: "7. Produits vendus",
    blocs: [
      {
        type: "p",
        texte:
          "Un produit marqué comme « vendu » n'est plus considéré comme disponible à la vente sur Makiti.",
      },
      {
        type: "p",
        texte: "Makiti ne gère pas de stock et ne garantit pas la disponibilité réelle d'un produit.",
      },
      {
        type: "p",
        texte:
          "Le commerçant doit mettre à jour l'état de ses produits lorsqu'ils ne sont plus disponibles.",
      },
    ],
  },
  {
    titre: "8. Contenus interdits",
    blocs: [
      { type: "p", texte: "Il est interdit d'utiliser Makiti pour publier, proposer ou promouvoir :" },
      {
        type: "liste",
        points: [
          "des produits ou services illégaux ;",
          "des produits contrefaits ou frauduleux ;",
          "des produits volés ;",
          "des contenus portant atteinte aux droits d'autrui ;",
          "des contenus trompeurs ou frauduleux ;",
          "des contenus à caractère abusif, menaçant ou harcelant ;",
          "des contenus contenant des logiciels malveillants ;",
          "des contenus destinés à contourner les règles de Makiti.",
        ],
      },
      {
        type: "p",
        texte:
          "Makiti peut retirer tout contenu qu'elle estime contraire aux présentes Conditions ou à la législation applicable.",
      },
    ],
  },
  {
    titre: "9. Photos, descriptions et autres contenus",
    blocs: [
      { type: "p", texte: "L'utilisateur reste responsable des contenus qu'il publie." },
      {
        type: "p",
        texte:
          "Il garantit disposer des droits nécessaires pour publier les photos, textes, logos et autres contenus transmis à Makiti.",
      },
      {
        type: "p",
        texte:
          "En publiant un contenu sur Makiti, l'utilisateur accorde à Makiti une autorisation non exclusive d'héberger, reproduire, afficher et adapter ce contenu dans la mesure nécessaire au fonctionnement, à la sécurité, à la promotion et à l'amélioration de la plateforme.",
      },
      { type: "p", texte: "Cette autorisation ne transfère pas la propriété du contenu à Makiti." },
    ],
  },
  {
    titre: "10. Messagerie",
    blocs: [
      {
        type: "p",
        texte:
          "La messagerie est destinée aux échanges liés aux produits, boutiques et éventuelles transactions.",
      },
      { type: "p", texte: "Il est interdit notamment de :" },
      {
        type: "liste",
        points: [
          "harceler ou menacer un utilisateur ;",
          "envoyer des messages répétitifs ou du spam ;",
          "diffuser des contenus illégaux ;",
          "tenter d'obtenir frauduleusement des informations personnelles ou financières ;",
          "utiliser la messagerie pour contourner les restrictions de Makiti ;",
          "utiliser des moyens automatisés abusifs.",
        ],
      },
      { type: "p", texte: "Makiti peut limiter ou suspendre l'accès à la messagerie en cas d'abus." },
    ],
  },
  {
    titre: "11. Signalements et modération",
    blocs: [
      {
        type: "p",
        texte:
          "Les utilisateurs peuvent signaler un produit, une boutique ou un comportement qu'ils considèrent comme problématique.",
      },
      {
        type: "p",
        texte:
          "Makiti peut examiner les signalements et prendre les mesures qu'elle estime appropriées, notamment :",
      },
      {
        type: "liste",
        points: [
          "masquer un produit ;",
          "retirer un contenu ;",
          "suspendre une boutique ;",
          "suspendre un compte ;",
          "limiter certaines fonctionnalités.",
        ],
      },
      {
        type: "p",
        texte:
          "La modération de Makiti ne constitue pas une garantie que tous les contenus ou utilisateurs présents sur la plateforme ont été vérifiés.",
      },
    ],
  },
  {
    titre: "12. Limites d'utilisation",
    blocs: [
      {
        type: "p",
        texte:
          "Afin de protéger la plateforme et ses utilisateurs, Makiti peut appliquer des limites d'utilisation, notamment concernant :",
      },
      {
        type: "liste",
        points: [
          "le nombre de boutiques contactées ;",
          "le nombre de messages envoyés ;",
          "certaines actions répétitives ou automatisées.",
        ],
      },
      {
        type: "p",
        texte:
          "Ces limites peuvent être modifiées pour des raisons de sécurité, de performance ou de lutte contre les abus.",
      },
    ],
  },
  {
    titre: "13. Sécurité du compte",
    blocs: [
      {
        type: "p",
        texte:
          "L'utilisateur doit conserver ses identifiants confidentiels et ne pas permettre à une autre personne d'utiliser son compte.",
      },
      {
        type: "p",
        texte: "Il doit informer Makiti dès qu'il constate une utilisation non autorisée de son compte.",
      },
      { type: "p", texte: "Il est interdit de :" },
      {
        type: "liste",
        points: [
          "tenter d'accéder au compte d'un autre utilisateur ;",
          "contourner les mécanismes de sécurité ;",
          "exploiter une vulnérabilité ;",
          "perturber volontairement le fonctionnement de Makiti ;",
          "récupérer ou utiliser des données auxquelles l'utilisateur n'a pas droit d'accès.",
        ],
      },
    ],
  },
  {
    titre: "14. Suspension ou fermeture d'un compte",
    blocs: [
      {
        type: "p",
        texte:
          "Makiti peut suspendre ou fermer un compte, une boutique ou certaines fonctionnalités lorsqu'une violation des présentes Conditions est constatée, lorsqu'une activité présente un risque pour les utilisateurs ou lorsque la loi l'exige.",
      },
      {
        type: "p",
        texte:
          "La suspension peut notamment concerner un commerçant faisant l'objet d'un litige ou d'un signalement sérieux.",
      },
      {
        type: "p",
        texte:
          "Une suspension peut entraîner l'impossibilité de publier, contacter ou répondre aux utilisateurs selon la nature de la mesure.",
      },
      {
        type: "p",
        texte:
          "L'utilisateur peut également demander la fermeture de son compte selon les fonctionnalités disponibles sur Makiti.",
      },
    ],
  },
  {
    titre: "15. Litiges entre utilisateurs",
    blocs: [
      { type: "p", texte: "Les utilisateurs sont responsables de leurs relations et transactions." },
      {
        type: "p",
        texte:
          "En cas de désaccord concernant un produit ou une transaction, le client et le commerçant doivent en priorité tenter de résoudre directement leur différend.",
      },
      {
        type: "p",
        texte:
          "Makiti peut recevoir un signalement et prendre des mesures concernant l'utilisation de sa plateforme.",
      },
      {
        type: "p",
        texte:
          "Cependant, Makiti n'est pas arbitre des transactions et ne garantit pas le règlement d'un litige commercial entre utilisateurs.",
      },
    ],
  },
  {
    titre: "16. Absence de garantie sur les vendeurs et produits",
    blocs: [
      {
        type: "p",
        texte:
          "La présence d'un commerçant ou d'un produit sur Makiti ne signifie pas que Makiti certifie :",
      },
      {
        type: "liste",
        points: [
          "l'identité complète du commerçant ;",
          "la qualité du produit ;",
          "l'authenticité du produit ;",
          "la conformité du produit ;",
          "la disponibilité du produit ;",
          "le respect d'un engagement commercial.",
        ],
      },
      { type: "p", texte: "Les utilisateurs doivent rester prudents lors de leurs échanges et transactions." },
    ],
  },
  {
    titre: "17. Disponibilité de Makiti",
    blocs: [
      { type: "p", texte: "Makiti s'efforce de maintenir le service disponible." },
      { type: "p", texte: "Toutefois, des interruptions peuvent survenir notamment en raison :" },
      {
        type: "liste",
        points: [
          "de maintenance ;",
          "de problèmes techniques ;",
          "de défaillances de prestataires externes ;",
          "de problèmes de réseau ou d'accès Internet ;",
          "de circonstances indépendantes de la volonté de Makiti.",
        ],
      },
      { type: "p", texte: "Makiti ne garantit pas un fonctionnement permanent ou sans interruption." },
    ],
  },
  {
    titre: "18. Propriété intellectuelle de Makiti",
    blocs: [
      {
        type: "p",
        texte:
          "La plateforme, son interface, son identité visuelle, ses logos, ses textes, ses fonctionnalités et ses éléments techniques sont protégés par les droits applicables.",
      },
      {
        type: "p",
        texte:
          "Sauf autorisation, il est interdit de copier, reproduire, modifier, distribuer ou exploiter les éléments de Makiti au-delà de ce qui est nécessaire à l'utilisation normale du service.",
      },
    ],
  },
  {
    titre: "19. Données personnelles",
    blocs: [
      {
        type: "p",
        texte:
          "Makiti traite certaines données personnelles nécessaires au fonctionnement du service, notamment pour la création de comptes, la gestion des boutiques, la messagerie et la sécurité.",
      },
      {
        type: "p",
        texte:
          "Les modalités de collecte, d'utilisation, de conservation et de protection de ces données sont précisées dans la Politique de confidentialité de Makiti.",
      },
    ],
  },
  {
    titre: "20. Modifications du service",
    blocs: [
      { type: "p", texte: "Makiti peut modifier, ajouter ou supprimer certaines fonctionnalités." },
      {
        type: "p",
        texte:
          "Les fonctionnalités actuellement disponibles peuvent évoluer, notamment lors du développement de nouvelles versions.",
      },
      { type: "p", texte: "Makiti peut également modifier les présentes Conditions." },
      {
        type: "p",
        texte:
          "La nouvelle version sera publiée sur la plateforme et indiquera sa date de mise à jour.",
      },
    ],
  },
  {
    titre: "21. Responsabilité",
    blocs: [
      {
        type: "p",
        texte:
          "Makiti fournit un service de mise en relation et ne contrôle pas directement les relations commerciales entre utilisateurs.",
      },
      {
        type: "p",
        texte:
          "Dans les limites autorisées par la loi, Makiti ne peut être tenue responsable des conséquences résultant notamment :",
      },
      {
        type: "liste",
        points: [
          "d'une transaction entre utilisateurs ;",
          "d'un produit vendu par un commerçant ;",
          "d'informations incorrectes publiées par un utilisateur ;",
          "d'un comportement frauduleux d'un utilisateur ;",
          "d'un problème de paiement ou de livraison organisé entre utilisateurs ;",
          "d'une indisponibilité temporaire de la plateforme.",
        ],
      },
      {
        type: "p",
        texte:
          "Aucune disposition des présentes Conditions n'a pour objet d'exclure une responsabilité qui ne peut légalement être exclue.",
      },
    ],
  },
  {
    titre: "22. Respect de la législation",
    blocs: [
      {
        type: "p",
        texte:
          "Chaque utilisateur doit utiliser Makiti conformément aux lois et règlements qui lui sont applicables.",
      },
      {
        type: "p",
        texte:
          "Le commerçant reste notamment responsable de respecter les règles applicables à son activité commerciale, à ses produits et à ses ventes.",
      },
    ],
  },
  {
    titre: "23. Droit applicable et règlement des différends",
    blocs: [
      { type: "p", texte: "Les présentes Conditions sont interprétées conformément au droit applicable." },
      {
        type: "p",
        texte:
          "En cas de différend concernant l'utilisation de Makiti, les parties s'efforceront d'abord de rechercher une solution amiable.",
      },
      {
        type: "p",
        texte:
          "À défaut d'accord amiable, le différend pourra être soumis aux juridictions compétentes conformément aux règles de droit applicables.",
      },
    ],
  },
  {
    titre: "24. Contact",
    blocs: [
      {
        type: "p",
        texte:
          "Pour toute question, demande ou signalement concernant Makiti, l'utilisateur peut utiliser le moyen de contact indiqué sur la plateforme.",
      },
    ],
  },
  {
    titre: "25. Acceptation",
    blocs: [
      {
        type: "p",
        texte:
          "En créant un compte ou en utilisant les fonctionnalités de Makiti, l'utilisateur reconnaît avoir pris connaissance des présentes Conditions et les accepter.",
      },
      {
        type: "p",
        texte:
          "Si l'utilisateur n'accepte pas ces Conditions, il ne doit pas utiliser les fonctionnalités auxquelles elles s'appliquent.",
      },
    ],
  },
];

export default async function ConditionsPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  const { retour } = await searchParams;

  return (
    <Screen>
      <TopBar title="Conditions d'utilisation" backHref={safeNextPath(retour) ?? "/"} />

      <ScreenBody>
        <Section className="gap-5 py-5">
          <p className="text-xs text-ink-soft">Dernière mise à jour : {MISE_A_JOUR}</p>

          {PREAMBULE.map((texte) => (
            <p key={texte} className="text-base leading-relaxed">
              {texte}
            </p>
          ))}

          {ARTICLES.map((article) => (
            <section key={article.titre} className="flex flex-col gap-2.5">
              {/* `scroll-mt` n'est pas utile ici : aucun sommaire n'y
                  renvoie. Un document de 25 articles se lit d'un bout à
                  l'autre sur un téléphone — on ne saute pas, on fait
                  défiler. */}
              <h2 className="font-display text-lg font-bold">{article.titre}</h2>

              {article.blocs.map((bloc, i) =>
                bloc.type === "p" ? (
                  <p key={i} className="text-base leading-relaxed text-ink-soft">
                    {bloc.texte}
                  </p>
                ) : (
                  <ul key={i} className="flex flex-col gap-1.5 pl-4">
                    {bloc.points.map((point) => (
                      <li key={point} className="list-disc text-base leading-relaxed text-ink-soft">
                        {point}
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}

          <p className="pt-2 text-sm text-ink-soft">
            Makiti — Marketplace de mise en relation en Guinée.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
