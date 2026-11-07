/**
 * Ce texte engage le porteur du projet : chaque affirmation doit rester
 * vérifiable dans le dépôt. Sa date est ÉCRITE, jamais calculée.
 *
 * Réécrit de zéro le 2026-11-07 (décision du porteur du projet) : l'app
 * native est abandonnée, l'équipe Filloo administre le site, la publicité
 * et la mesure de fréquentation existent. Tout ce que Filloo fait des
 * données est dit ici, sobrement : un traitement passé sous silence serait
 * une tromperie, et contraire à la loi.
 */

export const CONFIDENTIALITE_MISE_A_JOUR = "7 novembre 2026";

export const CONTACT_EMAIL = "filloo.gn@gmail.com";

/**
 * La ville n'est pas en Guinée, et c'est exact : le service s'adresse au
 * marché guinéen, l'éditeur réside à Montréal.
 */
export const EDITEUR_NOM = "Boubacar Sow";
export const EDITEUR_VILLE = "Montréal, Canada";

export type BlocConfidentialite = string | string[];

export type ArticleConfidentialite = {
  numero: number;
  titre: string;
  blocs: BlocConfidentialite[];
};

export const CONFIDENTIALITE_PREAMBULE = [
  "Cette politique explique, simplement, quelles données l’application Filloo utilise, pourquoi, avec quels outils, combien de temps, et ce que vous pouvez demander.",
  "Filloo est une application web : elle s’ouvre dans le navigateur à l’adresse filloo.net et peut s’installer sur l’écran d’accueil de votre téléphone. Ce texte vaut pour toutes ces façons de l’utiliser.",
];

export const CONFIDENTIALITE: ArticleConfidentialite[] = [
  {
    numero: 1,
    titre: "Qui est responsable de vos données",
    blocs: [
      `Filloo est éditée par ${EDITEUR_NOM} (${EDITEUR_VILLE}), avec l’aide d’une petite équipe, appelée « l’équipe Filloo », qui répond aux utilisateurs et veille au respect des règles.`,
      `Pour toute question sur vos données : ${CONTACT_EMAIL}.`,
      "Filloo met en relation des clients et des commerçants en Guinée. Elle ne vend rien, n’encaisse aucun paiement et n’organise aucune livraison : la vente se conclut directement entre vous, hors de l’application. C’est pourquoi Filloo ne détient ni donnée bancaire, ni adresse de livraison, ni historique d’achat.",
    ],
  },
  {
    numero: 2,
    titre: "Ce que vous pouvez faire sans compte",
    blocs: [
      "Le catalogue, les fiches produit et les pages de boutique se consultent librement, sans compte.",
      "Un compte n’est demandé que pour écrire : contacter un commerçant, tenir une boutique, publier un produit, écrire à l’équipe Filloo.",
    ],
  },
  {
    numero: 3,
    titre: "Les données que vous nous confiez",
    blocs: [
      "Pour créer un compte : votre adresse email (votre identifiant), votre mot de passe, votre nom et votre numéro de téléphone. Le mot de passe n’est jamais stocké en clair : personne, pas même l’équipe Filloo, ne peut le lire.",
      "Pour tenir une boutique : son nom, sa ville, une indication d’adresse (par exemple « Marché Madina, allée 3 »), une description, une photo si vous le souhaitez, et un numéro WhatsApp si vous voulez être joint ainsi.",
      "Pour publier un produit : son titre, sa description, son prix, sa catégorie et ses photos.",
      "Pour échanger : les messages que vous écrivez à un commerçant, à un client ou à l’équipe Filloo, et le produit qu’ils citent.",
      "Si vous signalez un produit, une boutique ou une conversation : le motif que vous choisissez et ce que vous écrivez.",
      "Si vous demandez à mettre en avant vos produits ou votre boutique : votre demande et ce qu’elle vise.",
      "Si vous activez les notifications : l’adresse technique que votre navigateur fournit pour vous prévenir, et les clés qui chiffrent ces notifications. Elle désigne un appareil, pas une personne.",
    ],
  },
  {
    numero: 4,
    titre: "Ce que l’application enregistre en fonctionnant",
    blocs: [
      "Pour que Filloo marche, et pour l’améliorer, l’application enregistre aussi :",
      [
        "la date de création de votre compte et celle de votre dernière connexion ;",
        "les vérifications de mot de passe échouées, pour bloquer qui essaierait de deviner le vôtre ;",
        "la mesure de fréquentation de l’application : pages et produits consultés, recherches tapées, contacts ouverts, messages envoyés, produits mis en avant affichés ou touchés. Ces relevés ne contiennent ni votre nom, ni votre email, ni votre téléphone, ni votre adresse IP, ni le texte de vos messages ;",
        "les rapports d’erreur techniques, débarrassés de tout ce qui pourrait vous identifier, pour corriger les pannes.",
      ],
      "Filloo ne collecte pas votre position : la ville d’une boutique est toujours choisie à la main. Filloo ne fait aucun profilage publicitaire et ne vend aucune donnée, à personne.",
    ],
  },
  {
    numero: 5,
    titre: "Les cookies et ce qui reste sur votre appareil",
    blocs: [
      "Filloo utilise uniquement ses propres cookies, sans aucun cookie publicitaire ni cookie de réseau social :",
      [
        "un cookie de connexion, qui vous garde connecté ;",
        "un cookie de fréquentation, qui contient un numéro tiré au hasard, relié ni à votre compte, ni à votre nom, ni à votre adresse IP. Il permet seulement de reconnaître qu’un même navigateur revient. Il dure 13 mois au plus ;",
        "un cookie de préférences, qui retient les catégories et les boutiques que vous regardez le plus, pour vous les montrer d’abord. Il ne contient aucun identifiant et dure 6 mois au plus.",
      ],
      "Vos recherches récentes et certains réglages (comme le choix d’installer l’application) restent dans votre navigateur, sur votre appareil seulement.",
      "Vider les données de votre navigateur efface tout cela.",
    ],
  },
  {
    numero: 6,
    titre: "Pourquoi nous utilisons ces données",
    blocs: [
      [
        "faire fonctionner l’application : votre compte, votre boutique, vos produits, vos conversations ;",
        "vous prévenir d’un nouveau message, d’un message de l’équipe ou d’une décision concernant votre compte ;",
        "vous montrer d’abord ce qui vous intéresse, et afficher les produits mis en avant ;",
        "protéger les utilisateurs : bloquer le spam et les tentatives d’intrusion, traiter les signalements, suspendre ou supprimer les comptes qui ne respectent pas les règles ;",
        "comprendre comment l’application est utilisée, pour l’améliorer et décider de ce qu’il faut construire ensuite.",
      ],
    ],
  },
  {
    numero: 7,
    titre: "Qui voit quoi",
    blocs: [
      "Sont publics, visibles de tous même sans compte : le nom de votre boutique, sa ville, son indication d’adresse, sa description et sa photo, vos produits, leurs prix et leurs photos, et votre numéro WhatsApp si vous l’avez donné. Publier, c’est rendre public : c’est le but de l’application.",
      "Vos messages ne sont lus que par la personne à qui vous écrivez. Un autre utilisateur ne peut pas lire une conversation à laquelle il ne participe pas : la base de données elle-même l’interdit.",
      "Votre adresse email n’est jamais montrée à un autre utilisateur.",
      "L’équipe Filloo voit ce qui lui est nécessaire pour répondre et faire respecter les règles : les messages que vous lui écrivez, les informations de votre compte (nom, email, téléphone, dates d’inscription et de dernière connexion), votre boutique et tous ses produits, et, lorsqu’une conversation lui est signalée, les messages concernés. Chacune de ses décisions (suspension, suppression, retrait d’un produit) est enregistrée avec son auteur et son motif.",
    ],
  },
  {
    numero: 8,
    titre: "Les outils qui font fonctionner Filloo",
    blocs: [
      "Comme toute application, Filloo s’appuie sur des services spécialisés. Ils traitent vos données uniquement pour le compte de Filloo, pour faire fonctionner l’application :",
      [
        "Supabase : base de données, connexion aux comptes et stockage des photos, hébergés dans l’Union européenne (région de Paris) ;",
        "Vercel : hébergement de l’application, avec des serveurs à Paris ;",
        "Resend : envoi des emails de l’application (confirmation d’inscription, mot de passe oublié) ;",
        "Sentry : réception des rapports d’erreur, anonymisés avant l’envoi ;",
        "les services de notification de votre navigateur (Google, Apple, Mozilla ou Microsoft selon votre appareil), qui acheminent les notifications si vous les avez activées ; ils ne reçoivent jamais le texte de vos messages ;",
        "des outils de développement et d’assistance, dont un assistant d’intelligence artificielle, utilisés pour concevoir, maintenir et dépanner l’application ; ils peuvent accéder ponctuellement aux données, toujours sous la responsabilité de Filloo.",
      ],
      "Le bouton WhatsApp d’une boutique ouvre WhatsApp : ce qui s’y échange relève de WhatsApp et de ses propres règles, plus de Filloo.",
      "Certains de ces services sont établis hors de Guinée (Union européenne, États-Unis). Vos données peuvent donc y être traitées, avec les protections que ces prestataires appliquent.",
    ],
  },
  {
    numero: 9,
    titre: "Les emails et les notifications",
    blocs: [
      "Filloo ne vous écrit par email que pour votre compte : confirmer votre inscription, réinitialiser votre mot de passe. Aucun email publicitaire.",
      "Les nouveaux messages, les messages de l’équipe Filloo et les décisions concernant votre compte vous sont signalés par notification, si vous les avez activées.",
      "Une notification affichée sur un écran verrouillé ne contient jamais le texte d’un message ni le motif d’une décision : elle dit seulement que quelque chose vous attend.",
      "Les notifications se coupent à tout moment, depuis la cloche de l’application ou les réglages de votre navigateur.",
    ],
  },
  {
    numero: 10,
    titre: "Combien de temps nous gardons vos données",
    blocs: [
      [
        "votre compte, votre boutique et vos produits : tant que votre compte existe ;",
        "vos messages : tant que la conversation existe, car ils appartiennent aussi à la personne qui les a reçus ;",
        "les photos d’un produit : jusqu’à ce que le produit soit supprimé ou la photo retirée ;",
        "la mesure de fréquentation, y compris le numéro du cookie de fréquentation : 13 mois au plus ;",
        "les décisions de l’équipe et les signalements : le temps nécessaire à la sécurité de la plateforme.",
      ],
    ],
  },
  {
    numero: 11,
    titre: "Supprimer votre compte",
    blocs: [
      "Vous pouvez supprimer votre compte vous-même, depuis « Mes informations ». L’équipe Filloo peut aussi supprimer un compte qui ne respecte pas les règles. Dans les deux cas, la suppression est immédiate :",
      [
        "votre nom et votre téléphone sont effacés et remplacés par « Compte supprimé » ;",
        "pour une boutique : sa photo, son WhatsApp, son adresse et sa description sont effacés, ses produits retirés et leurs photos supprimées ;",
        "si c’était votre seul compte, votre accès est fermé aussitôt sur tous vos appareils, vos abonnements aux notifications sont effacés, et votre adresse email est libérée : elle pourra servir à un nouveau compte, qui n’héritera de rien.",
      ],
      "Si votre adresse porte à la fois un compte client et une boutique, supprimer l’un laisse l’autre intact, avec sa connexion.",
      "Ce qui reste : le texte des messages que vous avez envoyés, lisible par la personne qui les a reçus, sous le nom « Compte supprimé » ; et la trace d’une décision de l’équipe, si elle en a pris une.",
    ],
  },
  {
    numero: 12,
    titre: "Vos droits",
    blocs: [
      "Vous pouvez à tout moment consulter et corriger vos informations et celles de votre boutique, changer votre mot de passe, couper les notifications et supprimer votre compte, directement dans l’application.",
      `Pour toute autre demande — recevoir une copie de vos données, demander un effacement plus complet, vous opposer à un usage, poser une question — écrivez à ${CONTACT_EMAIL}. Nous répondons nous-mêmes, et nous vous disons clairement ce qui est possible.`,
      "Si vous estimez que vos droits ne sont pas respectés, vous pouvez aussi vous adresser à l’autorité de protection des données de votre pays.",
    ],
  },
  {
    numero: 13,
    titre: "La sécurité de vos données",
    blocs: [
      "Les règles qui décident qui peut lire et écrire quoi sont appliquées par la base de données elle-même, pas seulement par l’écran : contourner l’application ne donne pas accès aux données des autres. Ces règles sont vérifiées par des tests automatiques à chaque modification.",
      "Les échanges entre votre appareil et Filloo sont chiffrés.",
      "Aucun système n’est infaillible. Si un incident touchait vos données, nous vous préviendrions à l’adresse email de votre compte.",
    ],
  },
  {
    numero: 14,
    titre: "Les mineurs",
    blocs: ["Filloo est réservée aux personnes de 18 ans et plus, comme le prévoient les Conditions d’utilisation."],
  },
  {
    numero: 15,
    titre: "Les changements de cette politique",
    blocs: [
      "Cette politique change quand l’application change. Chaque nouvelle version porte sa date, en tête de cette page.",
    ],
  },
];

export const CONFIDENTIALITE_PIED =
  "En utilisant Filloo, vous reconnaissez avoir pris connaissance de cette Politique de confidentialité.";
