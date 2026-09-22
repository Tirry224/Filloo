/**
 * La politique de confidentialité, promise par l'article 19 des conditions
 * d'utilisation et qui n'existait nulle part.
 *
 * ÉCRITE À PARTIR DU CODE, PAS D'UN MODÈLE. Chaque affirmation de ce
 * fichier a été vérifiée dans le dépôt le 2026-09-21 : les colonnes des
 * migrations pour ce qui est collecté, `src/lib/actions/account.ts` pour
 * ce que fait la suppression de compte, `src/lib/notifications.ts` et
 * `src/lib/push.ts` pour les destinataires, `0002_rules_and_security.sql`
 * pour qui voit quoi. Une politique recopiée d'un générateur aurait promis
 * des choses fausses — et une promesse écrite qui ne se vérifie pas est
 * pire qu'un silence : c'est exactement le défaut que ce fichier répare.
 *
 * LE POINT LE PLUS DÉLICAT est l'article « Supprimer votre compte » : la
 * suppression ANONYMISE et BANNIT, elle n'efface pas tout. Le dire
 * franchement est la seule option tenable — quelqu'un qui découvre l'écart
 * entre la promesse et le comportement ne revient pas.
 *
 * Sa date est ÉCRITE, jamais calculée, pour la même raison que celle des
 * conditions : un `new Date()` ferait dire au document qu'il a été relu
 * aujourd'hui alors que personne ne l'a rouvert.
 */

export const CONFIDENTIALITE_MISE_A_JOUR = "21 septembre 2026";

/** L'adresse où l'on nous écrit — pour une question, un signalement, ou
 * l'exercice d'un droit sur ses données. Un seul endroit la porte : trois
 * copies auraient fini par ne plus désigner la même boîte. */
export const CONTACT_EMAIL = "bouliwelltirry@gmail.com";

/**
 * Le nom civil de l'éditeur, responsable du traitement.
 *
 * VIDE TANT QU'IL N'EST PAS FOURNI, et l'écran s'adapte : il nomme alors
 * « l'éditeur de Makiti » et donne l'adresse de contact, sans inventer
 * d'identité. Un nom fabriqué dans un document juridique serait une faute
 * plus grave que l'absence de nom — c'est le document entier qui
 * deviendrait suspect.
 *
 * À COMPLÉTER AVANT LE LANCEMENT : nom et prénom, puis la ville. Deux
 * chaînes, rien d'autre à changer ailleurs.
 */
export const EDITEUR_NOM = "";
export const EDITEUR_VILLE = "Conakry, Guinée";

export type BlocConfidentialite = string | string[];

export type ArticleConfidentialite = {
  numero: number;
  titre: string;
  blocs: BlocConfidentialite[];
};

export const CONFIDENTIALITE_PREAMBULE = [
  "Cette Politique de confidentialité explique quelles données Makiti collecte, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées, et ce que vous pouvez demander à leur sujet.",
  "Elle complète les Conditions d’utilisation, dont l’article 19 y renvoie. Elle décrit le fonctionnement réel de la plateforme, et non des intentions : si une pratique change, ce texte change avec elle et sa date de mise à jour l’indique.",
];

export const CONFIDENTIALITE: ArticleConfidentialite[] = [
  {
    numero: 1,
    titre: "Qui traite vos données",
    blocs: [
      "Makiti est une plateforme de mise en relation entre commerçants et clients en Guinée. Elle ne vend rien, n’encaisse aucun paiement et n’organise aucune livraison : la vente se conclut directement entre le client et le commerçant, hors de la plateforme.",
      "Cette précision n’est pas décorative : elle explique pourquoi Makiti ne détient aucune donnée bancaire, aucune adresse de livraison et aucun historique d’achat.",
    ],
  },
  {
    numero: 2,
    titre: "Ce que vous pouvez faire sans donner aucune donnée",
    blocs: [
      "Le catalogue, les fiches produit et les pages de boutique se consultent sans compte et sans inscription. Parcourir Makiti ne demande rien.",
      "Un compte n’est exigé que pour ÉCRIRE : contacter un commerçant, publier un produit, tenir une boutique.",
    ],
  },
  {
    numero: 3,
    titre: "Les données que vous nous donnez",
    blocs: [
      "À la création d’un compte :",
      [
        "votre adresse email, qui sert d’identifiant de connexion ;",
        "votre mot de passe, que nous ne stockons jamais en clair et que personne chez Makiti ne peut lire ;",
        "votre nom, affiché à votre interlocuteur dans la messagerie ;",
        "votre numéro de téléphone ;",
        "votre ville, si vous la renseignez, pour filtrer le catalogue.",
      ],
      "Si vous tenez une boutique, s’y ajoutent le nom de votre boutique, sa description, sa ville, une indication d’adresse (par exemple « Marché Madina, allée 3 ») et, si vous le souhaitez, un numéro WhatsApp.",
      "Quand vous publiez un produit : son titre, sa description, son prix, sa catégorie et ses photos.",
      "Quand vous écrivez à quelqu’un : le contenu de vos messages et le produit qu’ils citent.",
      "Si vous activez les notifications sur votre téléphone : l’adresse technique de votre appareil fournie par votre navigateur, et les clés qui permettent de lui envoyer un message chiffré. Cette adresse identifie un appareil, pas une personne, et sert uniquement à vous prévenir.",
    ],
  },
  {
    numero: 4,
    titre: "Ce que nous ne collectons pas",
    blocs: [
      "Makiti ne collecte pas :",
      [
        "de données bancaires ou de moyen de paiement — il n’y a pas de paiement en ligne ;",
        "d’adresse de livraison — il n’y a pas de livraison ;",
        "de position géographique automatique : le filtre de ville est toujours choisi à la main, jamais déduit de votre appareil ;",
        "de données de profilage publicitaire, et Makiti ne vend aucune donnée à personne.",
      ],
      "Vos recherches récentes sont enregistrées DANS VOTRE NAVIGATEUR, sur votre appareil uniquement. Elles ne sont jamais envoyées à Makiti, et vider les données de votre navigateur les efface.",
    ],
  },
  {
    numero: 5,
    titre: "Pourquoi nous traitons ces données",
    blocs: [
      [
        "faire fonctionner le service : votre compte, votre boutique, vos produits, vos conversations ;",
        "vous prévenir d’un nouveau message ou d’une décision concernant votre boutique, par email et, si vous les avez activées, par notification ;",
        "faire respecter les règles : lutte contre le spam, traitement des signalements, suspension des comptes abusifs ;",
        "comprendre l’usage du service, au moyen de compteurs qui ne contiennent aucun texte que vous avez écrit ni aucune donnée permettant de vous identifier.",
      ],
    ],
  },
  {
    numero: 6,
    titre: "Qui voit quoi",
    blocs: [
      "Sont PUBLICS, visibles de tout visiteur, même sans compte : le nom de votre boutique, sa description, sa ville, son indication d’adresse, ainsi que vos produits, leurs prix et leurs photos. Publier un produit, c’est le rendre public — c’est le but de la plateforme.",
      "Ne sont JAMAIS publics : votre adresse email, votre mot de passe, et le contenu de vos conversations.",
      "Votre nom et vos messages ne sont visibles que de votre interlocuteur, dans la conversation que vous avez avec lui. Un autre utilisateur ne peut pas lire une conversation à laquelle il ne participe pas : cette règle est appliquée par la base de données elle-même, et non par l’interface.",
      "Votre adresse email n’est communiquée à aucun autre utilisateur, dans aucune circonstance — y compris à la personne avec qui vous discutez.",
    ],
  },
  {
    numero: 7,
    titre: "Les prestataires qui hébergent vos données",
    blocs: [
      "Makiti s’appuie sur trois prestataires, et sur aucun autre :",
      [
        "Supabase, pour la base de données, l’authentification et le stockage des photos. Les données sont hébergées dans l’Union européenne (région de Paris).",
        "Vercel, pour l’hébergement de l’application.",
        "Resend, pour l’envoi des emails du service.",
      ],
      "Ces prestataires traitent les données pour le compte de Makiti et selon ses instructions. Makiti ne partage vos données avec aucun annonceur, aucun courtier en données et aucun réseau social.",
    ],
  },
  {
    numero: 8,
    titre: "Les emails et notifications que vous recevez",
    blocs: [
      "Makiti vous écrit uniquement pour des raisons liées au service : confirmation d’inscription, réinitialisation de mot de passe, réception d’un nouveau message, décision concernant votre boutique (validée, refusée) ou suspension de votre compte.",
      "Aucun email publicitaire, aucune lettre d’information.",
      "Vous n’êtes prévenu d’un nouveau message que si vous n’avez pas déjà un message non lu dans la même conversation : deux avertissements pour la même chose n’apprendraient rien de plus.",
      "Les notifications affichées sur un écran verrouillé ne contiennent jamais le motif d’un refus ni celui d’une suspension : elles disent qu’une décision vous attend, et l’email dit laquelle. Ce qui peut être lu par-dessus votre épaule reste volontairement pauvre.",
      "Les notifications sur téléphone se désactivent à tout moment depuis « Mon compte », et depuis les réglages de votre appareil.",
    ],
  },
  {
    numero: 9,
    titre: "Combien de temps vos données sont conservées",
    blocs: [
      "Tant que votre compte existe, vos données sont conservées pour faire fonctionner le service.",
      "Les messages d’une conversation sont conservés tant que la conversation existe : ils appartiennent à deux personnes, et l’effacement par l’une priverait l’autre de ce qu’elle a reçu.",
      "Les photos d’un produit sont supprimées du stockage quand le produit est supprimé, ou quand elles sont retirées de sa fiche.",
    ],
  },
  {
    numero: 10,
    titre: "Supprimer votre compte, et ce que cela fait exactement",
    blocs: [
      "La suppression se demande depuis « Mon compte », et elle est immédiate. Voici précisément ce qu’elle fait — le dire vaut mieux que de laisser croire à un effacement total :",
      [
        "votre nom et votre numéro de téléphone sont remplacés par des valeurs anonymes ; votre nom disparaît donc des conversations, remplacé par « Compte supprimé » ;",
        "les produits de votre boutique sont retirés du catalogue ;",
        "les abonnements aux notifications de tous vos appareils sont effacés ;",
        "votre accès est définitivement fermé : il n’est plus possible de se connecter avec ce compte.",
      ],
      "Ce qui n’est PAS effacé, et pourquoi : le texte de vos messages passés reste lisible par votre interlocuteur, comme un message reçu reste dans une boîte mail après le départ de son expéditeur ; et votre adresse email reste enregistrée, ce qui empêche la réouverture d’un compte fermé.",
      `Si vous souhaitez l’effacement complet de votre adresse email, écrivez-nous à ${CONTACT_EMAIL} : la demande est traitée à la main.`,
    ],
  },
  {
    numero: 11,
    titre: "Vos droits",
    blocs: [
      "Vous pouvez à tout moment :",
      [
        "consulter et corriger votre nom, votre téléphone et votre ville depuis « Mes informations » ;",
        "modifier les informations de votre boutique depuis votre espace commerçant ;",
        "modifier votre mot de passe, ou le réinitialiser si vous l’avez oublié ;",
        "désactiver les notifications ;",
        "supprimer votre compte.",
      ],
      `Pour toute autre demande concernant vos données — obtenir une copie de ce que nous détenons, demander un effacement complet, contester un traitement — écrivez à ${CONTACT_EMAIL}. Nous répondons à la main, et nous vous dirons ce qui est possible et ce qui ne l’est pas.`,
    ],
  },
  {
    numero: 12,
    titre: "La sécurité de vos données",
    blocs: [
      "Les règles qui déterminent qui peut lire et écrire quoi sont appliquées par la base de données elle-même, et pas seulement par l’interface : contourner l’application ne donne pas accès aux données des autres. Ces règles font l’objet de tests automatisés rejoués à chaque modification.",
      "Les échanges entre votre téléphone et Makiti sont chiffrés. Votre mot de passe est stocké sous une forme qui ne permet pas de le retrouver.",
      "Aucun système n’est infaillible. En cas d’incident touchant vos données, nous vous en informerons à l’adresse de votre compte.",
    ],
  },
  {
    numero: 13,
    titre: "Les mineurs",
    blocs: [
      "Makiti n’est pas destinée aux personnes de moins de 18 ans, conformément aux Conditions d’utilisation.",
    ],
  },
  {
    numero: 14,
    titre: "Modifications de cette politique",
    blocs: [
      "Cette politique peut évoluer avec le service. Toute nouvelle version porte sa date de mise à jour, affichée en tête de cette page.",
    ],
  },
];

export const CONFIDENTIALITE_PIED =
  "En utilisant Makiti, vous reconnaissez avoir pris connaissance de cette Politique de confidentialité.";
