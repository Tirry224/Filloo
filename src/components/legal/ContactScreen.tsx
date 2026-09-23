import Link from "next/link";
import { Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { CONTACT_EMAIL } from "@/content/confidentialite";

/**
 * L'article 24 des conditions promet « le moyen de contact indiqué sur la
 * plateforme » : cet écran est ce moyen.
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
