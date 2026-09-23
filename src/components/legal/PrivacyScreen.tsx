import Link from "next/link";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { Articles } from "@/components/legal/Articles";
import {
  CONFIDENTIALITE,
  CONFIDENTIALITE_MISE_A_JOUR,
  CONFIDENTIALITE_PIED,
  CONFIDENTIALITE_PREAMBULE,
  CONTACT_EMAIL,
  EDITEUR_NOM,
  EDITEUR_VILLE,
} from "@/content/confidentialite";

/**
 * Politique de confidentialité — promise par l'article 19 des conditions
 * d'utilisation.
 */
export function PrivacyScreen({ backHref, prefixe = "" }: { backHref: string; prefixe?: string }) {
  return (
    <Screen>
      <TopBar title="Politique de confidentialité" backHref={backHref} />

      <ScreenBody>
        <Section className="gap-5 py-6">
          <p className="text-sm text-ink-soft">
            Dernière mise à jour : {CONFIDENTIALITE_MISE_A_JOUR}
          </p>

          {CONFIDENTIALITE_PREAMBULE.map((paragraphe) => (
            <p key={paragraphe} className="text-base leading-relaxed">
              {paragraphe}
            </p>
          ))}

          <Articles articles={CONFIDENTIALITE} />

          <section className="flex flex-col gap-2.5">
            <h2 className="text-base font-semibold">Responsable du traitement</h2>
            {EDITEUR_NOM ? (
              <p className="text-base leading-relaxed">
                {EDITEUR_NOM}, éditeur de Makiti — {EDITEUR_VILLE}.
              </p>
            ) : null}
            <p className="text-base leading-relaxed">
              Pour toute question sur vos données :{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="text-base leading-relaxed">
              <Link href={`${prefixe}/contact`} className="font-semibold text-accent underline">
                Toutes les façons de nous joindre
              </Link>
            </p>
          </section>

          <p className="text-sm text-ink-soft">{CONFIDENTIALITE_PIED}</p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
