import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { Articles } from "@/components/legal/Articles";
import {
  CONDITIONS,
  CONDITIONS_MISE_A_JOUR,
  CONDITIONS_PIED,
  CONDITIONS_PREAMBULE,
} from "@/content/conditions";

export function TermsScreen({ backHref }: { backHref: string }) {
  return (
    <Screen>
      <TopBar title="Conditions d'utilisation" backHref={backHref} />

      <ScreenBody>
        <Section className="gap-5 py-6">
          {/* L'article 20 promet que la date de mise à jour soit indiquée. */}
          <p className="text-sm text-ink-soft">
            Dernière mise à jour : {CONDITIONS_MISE_A_JOUR}
          </p>

          {CONDITIONS_PREAMBULE.map((paragraphe) => (
            <p key={paragraphe} className="text-base leading-relaxed">
              {paragraphe}
            </p>
          ))}

          <Articles articles={CONDITIONS} />

          <p className="text-sm text-ink-soft">{CONDITIONS_PIED}</p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
