import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { AIDE, AIDE_ESSENTIEL } from "@/content/aide";
import { jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Comment ça marche",
  description:
    "Comment acheter et vendre sur Filloo : pas de paiement en ligne ni de livraison, tout se convient directement avec la boutique.",
  alternates: { canonical: "/aide" },
};

/* Lue par les moteurs et les assistants IA : les mêmes questions, les
   mêmes réponses que la page, rien de plus (Google refuse un balisage qui
   dit autre chose que ce qui s'affiche). */
const donneesStructurees = jsonLd({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: AIDE.flatMap((r) =>
    r.questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.reponse },
    })),
  ),
});

export default function AidePage() {
  return (
    <Screen>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesStructurees }} />
      <TopBar title="Comment ça marche" backHref="/" />

      <ScreenBody>
        <Section className="gap-6 py-6">
          {/* L'essentiel d'abord : le malentendu à éviter avant tout. */}
          <Card className="flex gap-3 p-4">
            <Info size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <p className="text-base leading-relaxed font-semibold">{AIDE_ESSENTIEL}</p>
          </Card>

          {AIDE.map((rubrique) => (
            <section key={rubrique.titre} className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">{rubrique.titre}</h2>
              {rubrique.questions.map((q) => (
                <div key={q.question} className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{q.question}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{q.reponse}</p>
                </div>
              ))}
              {rubrique.titre === "Vendre sur Filloo" ? (
                <Button variant="secondary" href="/inscription" className="self-start">
                  Ouvrir ma boutique
                </Button>
              ) : null}
            </section>
          ))}

          <p className="text-sm leading-normal text-ink-soft">
            Une autre question ?{" "}
            <Link href="/contact" className="font-semibold text-accent underline">
              Contactez-nous
            </Link>
            . Voir aussi les{" "}
            <Link href="/conditions" className="font-semibold text-accent underline">
              conditions d&apos;utilisation
            </Link>
            .
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
