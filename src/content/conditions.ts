/**
 * Le texte des conditions d'utilisation, fourni par le porteur du projet
 * le 2026-09-17.
 *
 * DANS UN FICHIER DE DONNÉES, PAS DANS L'ÉCRAN : un texte juridique se
 * relit et se corrige sans traverser du JSX, ni risquer l'affichage —
 * même raison que `composeNewMessageEmail`.
 *
 * SEULES LES APOSTROPHES ONT ÉTÉ MODIFIÉES : la source mélangeait ’ et ',
 * tout est uniformisé en ’, que les téléphones rendent correctement.
 * Aucun mot, aucune clause, aucun ordre — ce texte engage le porteur du
 * projet, il ne s'améliore pas en passant par ici.
 *
 * SA DATE EST DANS LE TEXTE, ET C'EST VOULU : l'article 20 promet que
 * toute nouvelle version « indiquera sa date de mise à jour ». Calculée à
 * l'affichage (`new Date()`), elle tiendrait la promesse en mentant, en
 * changeant chaque jour sans qu'une ligne du texte ne bouge.
 */

export const CONDITIONS_MISE_A_JOUR = "17 septembre 2026";

export const CONDITIONS_PREAMBULE = [
  "Les présentes Conditions d’utilisation (« Conditions ») régissent l’accès et l’utilisation de Makiti (« Makiti », « nous », « notre » ou « la plateforme »).",
  "En créant un compte ou en utilisant Makiti, vous reconnaissez avoir lu et accepté ces Conditions.",
];

/** Un bloc est soit un paragraphe, soit une liste à puces. */
export type BlocConditions = string | string[];

export type ArticleConditions = {
  /** Numéroté comme dans le texte d'origine : la numérotation sert à s'y
   *  référer dans un échange, donc elle ne se recalcule pas. */
  numero: number;
  titre: string;
  blocs: BlocConditions[];
};

export const CONDITIONS: ArticleConditions[] = [
  {
    numero: 1,
    titre: "Objet de Makiti",
    blocs: [
      "Makiti est une plateforme de mise en relation permettant aux commerçants de présenter leurs produits et aux clients de les découvrir et de contacter les commerçants.",
      "Makiti permet notamment :",
      [
        "la consultation du catalogue sans création de compte ;",
        "la recherche de produits et de boutiques ;",
        "le filtrage par ville et catégorie ;",
        "la création et la gestion d’une boutique ;",
        "la publication de produits ;",
        "la messagerie entre clients et commerçants ;",
        "le signalement de contenus ou de comportements problématiques.",
      ],
      "Makiti n’est pas le vendeur des produits présents sur la plateforme et n’est pas partie aux transactions entre utilisateurs.",
    ],
  },
  {
    numero: 2,
    titre: "Transactions entre utilisateurs",
    blocs: [
      "Makiti ne fournit actuellement :",
      [
        "aucun paiement en ligne ;",
        "aucun panier ;",
        "aucun service de livraison ;",
        "aucune gestion de stock ;",
        "aucun système de notation ou d’avis.",
      ],
      "Le prix, le paiement, la livraison ou remise du produit et les autres conditions de vente sont convenus directement entre le client et le commerçant.",
      "Makiti ne garantit donc pas qu’une transaction aura lieu ni qu’elle sera correctement exécutée.",
      "Le client doit effectuer les vérifications qu’il juge nécessaires avant toute transaction.",
    ],
  },
  {
    numero: 3,
    titre: "Conditions d’accès",
    blocs: [
      "La consultation du catalogue est accessible sans compte.",
      "Un compte est nécessaire pour utiliser certaines fonctionnalités, notamment la messagerie.",
      "L’utilisateur doit fournir des informations exactes et à jour lors de son inscription.",
      "Le numéro de téléphone est demandé pour le compte mais n’est pas vérifié par SMS dans la version actuelle de Makiti. L’utilisateur reste responsable de l’exactitude du numéro fourni.",
    ],
  },
  {
    numero: 4,
    titre: "Compte client et compte commerçant",
    blocs: [
      "Une même personne peut disposer d’un compte client et d’un compte commerçant liés à une même connexion.",
      "Ces deux espaces restent séparés :",
      [
        "les données client appartiennent à l’espace client ;",
        "les données de boutique appartiennent à l’espace commerçant ;",
        "les historiques et actions de chaque espace restent séparés ;",
        "une suspension du compte client ne signifie pas automatiquement la suspension de la boutique, et inversement.",
      ],
      "L’utilisateur ne doit pas tenter de contourner une suspension en utilisant un autre compte ou espace.",
    ],
  },
  {
    numero: 5,
    titre: "Compte commerçant et validation",
    blocs: [
      "La création d’un espace commerçant ne signifie pas que la boutique est automatiquement approuvée.",
      "Makiti peut effectuer un contrôle avant l’activation de la boutique.",
      "Un commerçant en attente de validation peut préparer sa boutique et ses produits en brouillon.",
      "Makiti peut :",
      [
        "approuver une boutique ;",
        "demander des corrections ou informations complémentaires ;",
        "refuser une boutique ;",
        "suspendre une boutique précédemment approuvée.",
      ],
      "La validation d’une boutique ne constitue pas une certification, une garantie de solvabilité ou une garantie concernant les produits du commerçant.",
    ],
  },
  {
    numero: 6,
    titre: "Responsabilité des commerçants",
    blocs: [
      "Le commerçant est seul responsable des informations qu’il publie, notamment :",
      [
        "nom de la boutique ;",
        "ville ;",
        "numéro de téléphone ;",
        "coordonnées WhatsApp lorsqu’elles sont fournies ;",
        "prix ;",
        "description ;",
        "photos ;",
        "disponibilité du produit.",
      ],
      "Le commerçant doit maintenir ces informations aussi exactes et à jour que possible.",
      "Il ne doit pas publier volontairement des informations fausses, trompeuses ou destinées à induire un client en erreur.",
    ],
  },
  {
    numero: 7,
    titre: "Produits vendus",
    blocs: [
      "Un produit marqué comme « vendu » n’est plus considéré comme disponible à la vente sur Makiti.",
      "Makiti ne gère pas de stock et ne garantit pas la disponibilité réelle d’un produit.",
      "Le commerçant doit mettre à jour l’état de ses produits lorsqu’ils ne sont plus disponibles.",
    ],
  },
  {
    numero: 8,
    titre: "Contenus interdits",
    blocs: [
      "Il est interdit d’utiliser Makiti pour publier, proposer ou promouvoir :",
      [
        "des produits ou services illégaux ;",
        "des produits contrefaits ou frauduleux ;",
        "des produits volés ;",
        "des contenus portant atteinte aux droits d’autrui ;",
        "des contenus trompeurs ou frauduleux ;",
        "des contenus à caractère abusif, menaçant ou harcelant ;",
        "des contenus contenant des logiciels malveillants ;",
        "des contenus destinés à contourner les règles de Makiti.",
      ],
      "Makiti peut retirer tout contenu qu’elle estime contraire aux présentes Conditions ou à la législation applicable.",
    ],
  },
  {
    numero: 9,
    titre: "Photos, descriptions et autres contenus",
    blocs: [
      "L’utilisateur reste responsable des contenus qu’il publie.",
      "Il garantit disposer des droits nécessaires pour publier les photos, textes, logos et autres contenus transmis à Makiti.",
      "En publiant un contenu sur Makiti, l’utilisateur accorde à Makiti une autorisation non exclusive d’héberger, reproduire, afficher et adapter ce contenu dans la mesure nécessaire au fonctionnement, à la sécurité, à la promotion et à l’amélioration de la plateforme.",
      "Cette autorisation ne transfère pas la propriété du contenu à Makiti.",
    ],
  },
  {
    numero: 10,
    titre: "Messagerie",
    blocs: [
      "La messagerie est destinée aux échanges liés aux produits, boutiques et éventuelles transactions.",
      "Il est interdit notamment de :",
      [
        "harceler ou menacer un utilisateur ;",
        "envoyer des messages répétitifs ou du spam ;",
        "diffuser des contenus illégaux ;",
        "tenter d’obtenir frauduleusement des informations personnelles ou financières ;",
        "utiliser la messagerie pour contourner les restrictions de Makiti ;",
        "utiliser des moyens automatisés abusifs.",
      ],
      "Makiti peut limiter ou suspendre l’accès à la messagerie en cas d’abus.",
    ],
  },
  {
    numero: 11,
    titre: "Signalements et modération",
    blocs: [
      "Les utilisateurs peuvent signaler un produit, une boutique ou un comportement qu’ils considèrent comme problématique.",
      "Makiti peut examiner les signalements et prendre les mesures qu’elle estime appropriées, notamment :",
      [
        "masquer un produit ;",
        "retirer un contenu ;",
        "suspendre une boutique ;",
        "suspendre un compte ;",
        "limiter certaines fonctionnalités.",
      ],
      "La modération de Makiti ne constitue pas une garantie que tous les contenus ou utilisateurs présents sur la plateforme ont été vérifiés.",
    ],
  },
  {
    numero: 12,
    titre: "Limites d’utilisation",
    blocs: [
      "Afin de protéger la plateforme et ses utilisateurs, Makiti peut appliquer des limites d’utilisation, notamment concernant :",
      [
        "le nombre de boutiques contactées ;",
        "le nombre de messages envoyés ;",
        "certaines actions répétitives ou automatisées.",
      ],
      "Ces limites peuvent être modifiées pour des raisons de sécurité, de performance ou de lutte contre les abus.",
    ],
  },
  {
    numero: 13,
    titre: "Sécurité du compte",
    blocs: [
      "L’utilisateur doit conserver ses identifiants confidentiels et ne pas permettre à une autre personne d’utiliser son compte.",
      "Il doit informer Makiti dès qu’il constate une utilisation non autorisée de son compte.",
      "Il est interdit de :",
      [
        "tenter d’accéder au compte d’un autre utilisateur ;",
        "contourner les mécanismes de sécurité ;",
        "exploiter une vulnérabilité ;",
        "perturber volontairement le fonctionnement de Makiti ;",
        "récupérer ou utiliser des données auxquelles l’utilisateur n’a pas droit d’accès.",
      ],
    ],
  },
  {
    numero: 14,
    titre: "Suspension ou fermeture d’un compte",
    blocs: [
      "Makiti peut suspendre ou fermer un compte, une boutique ou certaines fonctionnalités lorsqu’une violation des présentes Conditions est constatée, lorsqu’une activité présente un risque pour les utilisateurs ou lorsque la loi l’exige.",
      "La suspension peut notamment concerner un commerçant faisant l’objet d’un litige ou d’un signalement sérieux.",
      "Une suspension peut entraîner l’impossibilité de publier, contacter ou répondre aux utilisateurs selon la nature de la mesure.",
      "L’utilisateur peut également demander la fermeture de son compte selon les fonctionnalités disponibles sur Makiti.",
    ],
  },
  {
    numero: 15,
    titre: "Litiges entre utilisateurs",
    blocs: [
      "Les utilisateurs sont responsables de leurs relations et transactions.",
      "En cas de désaccord concernant un produit ou une transaction, le client et le commerçant doivent en priorité tenter de résoudre directement leur différend.",
      "Makiti peut recevoir un signalement et prendre des mesures concernant l’utilisation de sa plateforme.",
      "Cependant, Makiti n’est pas arbitre des transactions et ne garantit pas le règlement d’un litige commercial entre utilisateurs.",
    ],
  },
  {
    numero: 16,
    titre: "Absence de garantie sur les vendeurs et produits",
    blocs: [
      "La présence d’un commerçant ou d’un produit sur Makiti ne signifie pas que Makiti certifie :",
      [
        "l’identité complète du commerçant ;",
        "la qualité du produit ;",
        "l’authenticité du produit ;",
        "la conformité du produit ;",
        "la disponibilité du produit ;",
        "le respect d’un engagement commercial.",
      ],
      "Les utilisateurs doivent rester prudents lors de leurs échanges et transactions.",
    ],
  },
  {
    numero: 17,
    titre: "Disponibilité de Makiti",
    blocs: [
      "Makiti s’efforce de maintenir le service disponible.",
      "Toutefois, des interruptions peuvent survenir notamment en raison :",
      [
        "de maintenance ;",
        "de problèmes techniques ;",
        "de défaillances de prestataires externes ;",
        "de problèmes de réseau ou d’accès Internet ;",
        "de circonstances indépendantes de la volonté de Makiti.",
      ],
      "Makiti ne garantit pas un fonctionnement permanent ou sans interruption.",
    ],
  },
  {
    numero: 18,
    titre: "Propriété intellectuelle de Makiti",
    blocs: [
      "La plateforme, son interface, son identité visuelle, ses logos, ses textes, ses fonctionnalités et ses éléments techniques sont protégés par les droits applicables.",
      "Sauf autorisation, il est interdit de copier, reproduire, modifier, distribuer ou exploiter les éléments de Makiti au-delà de ce qui est nécessaire à l’utilisation normale du service.",
    ],
  },
  {
    numero: 19,
    titre: "Données personnelles",
    blocs: [
      "Makiti traite certaines données personnelles nécessaires au fonctionnement du service, notamment pour la création de comptes, la gestion des boutiques, la messagerie et la sécurité.",
      "Les modalités de collecte, d’utilisation, de conservation et de protection de ces données sont précisées dans la Politique de confidentialité de Makiti.",
    ],
  },
  {
    numero: 20,
    titre: "Modifications du service",
    blocs: [
      "Makiti peut modifier, ajouter ou supprimer certaines fonctionnalités.",
      "Les fonctionnalités actuellement disponibles peuvent évoluer, notamment lors du développement de nouvelles versions.",
      "Makiti peut également modifier les présentes Conditions.",
      "La nouvelle version sera publiée sur la plateforme et indiquera sa date de mise à jour.",
    ],
  },
  {
    numero: 21,
    titre: "Responsabilité",
    blocs: [
      "Makiti fournit un service de mise en relation et ne contrôle pas directement les relations commerciales entre utilisateurs.",
      "Dans les limites autorisées par la loi, Makiti ne peut être tenue responsable des conséquences résultant notamment :",
      [
        "d’une transaction entre utilisateurs ;",
        "d’un produit vendu par un commerçant ;",
        "d’informations incorrectes publiées par un utilisateur ;",
        "d’un comportement frauduleux d’un utilisateur ;",
        "d’un problème de paiement ou de livraison organisé entre utilisateurs ;",
        "d’une indisponibilité temporaire de la plateforme.",
      ],
      "Aucune disposition des présentes Conditions n’a pour objet d’exclure une responsabilité qui ne peut légalement être exclue.",
    ],
  },
  {
    numero: 22,
    titre: "Respect de la législation",
    blocs: [
      "Chaque utilisateur doit utiliser Makiti conformément aux lois et règlements qui lui sont applicables.",
      "Le commerçant reste notamment responsable de respecter les règles applicables à son activité commerciale, à ses produits et à ses ventes.",
    ],
  },
  {
    numero: 23,
    titre: "Droit applicable et règlement des différends",
    blocs: [
      "Les présentes Conditions sont interprétées conformément au droit applicable.",
      "En cas de différend concernant l’utilisation de Makiti, les parties s’efforceront d’abord de rechercher une solution amiable.",
      "À défaut d’accord amiable, le différend pourra être soumis aux juridictions compétentes conformément aux règles de droit applicables.",
    ],
  },
  {
    numero: 24,
    titre: "Contact",
    blocs: [
      "Pour toute question, demande ou signalement concernant Makiti, l’utilisateur peut utiliser le moyen de contact indiqué sur la plateforme.",
    ],
  },
  {
    numero: 25,
    titre: "Acceptation",
    blocs: [
      "En créant un compte ou en utilisant les fonctionnalités de Makiti, l’utilisateur reconnaît avoir pris connaissance des présentes Conditions et les accepter.",
      "Si l’utilisateur n’accepte pas ces Conditions, il ne doit pas utiliser les fonctionnalités auxquelles elles s’appliquent.",
    ],
  },
];

export const CONDITIONS_PIED = "Makiti — Marketplace de mise en relation en Guinée.";
