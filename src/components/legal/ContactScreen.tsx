import Link from "next/link";
import { Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { CONTACT_EMAIL } from "@/content/confidentialite";

/**
 * « Nous contacter » — l'article 24 des conditions promet « le moyen de
 * contact indiqué sur la plateforme », et aucun écran ne l'indiquait.
 *
 * Une promesse écrite noir sur blanc sans rien derrière vaut moins qu'un
 * silence, parce qu'elle se vérifie : quelqu'un dont la boutique est
 * refusée lit l'article 24, cherche l'adresse, ne la trouve pas, et en
 * conclut qu'il n'y a personne au bout. Cet écran existe pour qu'il y ait
 * quelqu'un au bout.
 *
 * VOLONTAIREMENT SANS FORMULAIRE. Un formulaire de contact demanderait une
 * table, une file d'envoi, une protection anti-spam et un écran pour lire
 * ce qui arrive — quatre choses à construire et à surveiller. Un lien
 * `mailto:` ouvre l'application mail du téléphone, arrive dans une boîte
 * qu'un humain relève déjà (c'est la même que celle des réponses aux
 * emails de refus), et ne peut pas tomber en panne silencieusement.
 *
 * `prefixe` vaut "" côté client et "/vendeur" côté commerçant : les deux
 * espaces ne se mélangent JAMAIS sur un même écran (décision de SPEC), et
 * un lien codé en dur vers `/conditions` aurait renvoyé un commerçant
 * dans son espace d'acheteur au milieu d'une lecture.
 *
 * Il dit aussi ce que Makiti NE FAIT PAS : c'est ici qu'arrivent les
 * réclamations sur une commande, et elles n'ont pas d'objet — la vente se
 * conclut entre deux personnes, hors de la plateforme. Le dire sur cet
 * écran évite une déception au moment où elle coûte le plus cher.
 */
export function ContactScreen({ backHref, prefixe = "" }: { backHref: string; prefixe?: string }) {
  return (
    <Screen>
      <TopBar title="Nous contacter" backHref={backHref} />

      <ScreenBody>
        <Section className="gap-4 py-6">
          <p className="text-base leading-relaxed">
            Une question, un problème, un signalement ? Écrivez-nous. Les messages
            sont lus par une personne, pas par un robot — la réponse peut prendre
            un jour ou deux.
          </p>

          <Card className="flex flex-col gap-2.5 p-4">
            <p className="flex items-center gap-2.5 text-sm font-semibold">
              <Mail size={18} strokeWidth={1.9} className="shrink-0 text-accent" aria-hidden />
              Par email
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-base font-semibold break-all text-accent underline"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="text-sm leading-normal text-ink-soft">
              C&apos;est aussi l&apos;adresse à laquelle répondre si vous avez reçu un
              email de Makiti au sujet de votre boutique.
            </p>
          </Card>

          <Card className="flex flex-col gap-2.5 p-4">
            <p className="flex items-center gap-2.5 text-sm font-semibold">
              <ShieldAlert size={18} strokeWidth={1.9} className="shrink-0 text-accent" aria-hidden />
              Signaler un produit ou une conversation
            </p>
            <p className="text-sm leading-normal text-ink-soft">
              Le plus rapide est le bouton « Signaler » présent sur chaque fiche
              produit et dans chaque conversation : le signalement arrive avec le
              contexte, sans que vous ayez à l&apos;expliquer.
            </p>
          </Card>

          <Card className="flex flex-col gap-2.5 p-4">
            <p className="flex items-center gap-2.5 text-sm font-semibold">
              <MessageCircle size={18} strokeWidth={1.9} className="shrink-0 text-accent" aria-hidden />
              Une question sur un produit ou une commande
            </p>
            <p className="text-sm leading-normal text-ink-soft">
              Écrivez directement au commerçant depuis sa fiche produit. Makiti met
              en relation : elle ne vend pas, n&apos;encaisse aucun paiement et
              n&apos;organise aucune livraison. Le prix, la disponibilité et la
              remise du produit se règlent entre vous et le commerçant.
            </p>
          </Card>

          <p className="text-sm leading-normal text-ink-soft">
            Voir aussi les{" "}
            <Link href={`${prefixe}/conditions`} className="font-semibold text-accent underline">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href={`${prefixe}/confidentialite`} className="font-semibold text-accent underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
