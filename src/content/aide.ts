/**
 * Le texte de la page `/aide` (validée par le porteur du projet le
 * 2026-11-12). Le point qui compte le plus, à son avis : Filloo n'encaisse
 * aucun paiement et n'organise aucune livraison.
 *
 * Chaque réponse doit rester VRAIE au regard de `conditions.ts` : la page
 * est lue par les clients ET reprise par les moteurs et les assistants IA
 * (JSON-LD `FAQPage`). Ne jamais y promettre ce que Filloo ne fait pas.
 * Pas de « gratuit » pour les vendeurs : la tarification est en cours
 * (branche `monetisation`).
 */

export type QuestionAide = { question: string; reponse: string };
export type RubriqueAide = { titre: string; questions: QuestionAide[] };

export const AIDE_ESSENTIEL =
  "Filloo met en relation des clients et des boutiques en Guinée. Filloo ne vend rien, n'encaisse aucun paiement et n'organise aucune livraison : le prix, le paiement et la remise de l'article se conviennent directement avec la boutique.";

export const AIDE: RubriqueAide[] = [
  {
    titre: "Comment acheter",
    questions: [
      {
        question: "Comment acheter un article sur Filloo ?",
        reponse:
          "Trouvez l'article qui vous plaît, puis contactez la boutique depuis sa fiche, par WhatsApp ou par la messagerie Filloo. Vous convenez ensemble du prix, du paiement et de la remise.",
      },
      {
        question: "Faut-il un compte pour acheter ?",
        reponse:
          "Non pour regarder les articles : tout est consultable sans compte. Un compte est demandé seulement pour écrire à une boutique par la messagerie Filloo.",
      },
      {
        question: "Le prix affiché est-il négociable ?",
        reponse:
          "Le prix est fixé par la boutique. Quand un article porte la mention « Négociable », vous pouvez en discuter avec elle.",
      },
    ],
  },
  {
    titre: "Paiement et livraison",
    questions: [
      {
        question: "Comment se passe le paiement ?",
        reponse:
          "Il n'y a pas de paiement en ligne sur Filloo. Vous payez directement la boutique, de la manière convenue avec elle (espèces, mobile money ou autre).",
      },
      {
        question: "Filloo livre-t-il les articles ?",
        reponse:
          "Non, Filloo n'organise aucune livraison. Selon la boutique, vous récupérez l'article sur place ou vous convenez avec elle d'une livraison et de son prix.",
      },
      {
        question: "Je suis loin de la boutique, que faire ?",
        reponse:
          "La ville de la boutique est indiquée sur chaque article. Demandez-lui avant tout si elle peut vous faire parvenir l'article et à quelles conditions.",
      },
    ],
  },
  {
    titre: "Vendre sur Filloo",
    questions: [
      {
        question: "Comment ouvrir ma boutique ?",
        reponse:
          "Créez votre compte vendeur avec le bouton ci-dessous, puis publiez vos articles avec leurs photos, leur prix et leurs tailles. Les clients vous contactent directement.",
      },
      {
        question: "Qui s'occupe de la vente ?",
        reponse:
          "Vous. Vous répondez aux clients, fixez vos conditions de paiement et de remise, et marquez l'article comme vendu une fois la vente faite.",
      },
    ],
  },
  {
    titre: "Sécurité",
    questions: [
      {
        question: "Les boutiques sont-elles vérifiées ?",
        reponse:
          "Filloo ne vérifie pas les boutiques avant leur mise en ligne. Prenez les mêmes précautions qu'avec un vendeur que vous ne connaissez pas.",
      },
      {
        question: "Comment acheter en confiance ?",
        reponse:
          "Voyez l'article avant de payer quand c'est possible, et méfiez-vous d'un prix anormalement bas ou d'un acompte demandé avec insistance.",
      },
      {
        question: "Une annonce ou une boutique me semble suspecte",
        reponse:
          "Utilisez le bouton « Signaler » sur la fiche de l'article ou dans la conversation. L'équipe Filloo examine chaque signalement.",
      },
    ],
  },
];
