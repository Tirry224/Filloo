import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { Articles } from "@/components/legal/Articles";
import {
  CONDITIONS,
  CONDITIONS_MISE_A_JOUR,
  CONDITIONS_PIED,
  CONDITIONS_PREAMBULE,
} from "@/content/conditions";

/**
 * Conditions d'utilisation — écran 34.
 *
 * Un composant, deux routes, comme `ThreadScreen` : même texte, lien de
 * RETOUR différent. `backHref` est IMPOSÉ par la route et jamais lu dans
 * l'URL, un paramètre se perdant au favori ou au retour arrière.
 *
 * Aucune garde, et rien à garder : ce composant ne lit aucune donnée, et
 * `/conditions` est publique comme le catalogue — l'article 25 fait
 * accepter ces conditions à la création du compte, les cacher derrière une
 * inscription les ferait accepter sans les avoir lues.
 */
export function TermsScreen({ backHref }: { backHref: string }) {
  return (
    <Screen>
      <TopBar title="Conditions d'utilisation" backHref={backHref} />

      <ScreenBody>
        <Section className="gap-5 py-6">
          {/* La date d'abord, parce que c'est la seule information qui
              permet de savoir si l'on lit la version en vigueur — et
              parce que l'article 20 promet qu'elle soit indiquée. */}
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
