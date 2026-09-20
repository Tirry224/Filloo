import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import {
  CONDITIONS,
  CONDITIONS_MISE_A_JOUR,
  CONDITIONS_PIED,
  CONDITIONS_PREAMBULE,
} from "@/content/conditions";

/**
 * Conditions d'utilisation — écran 34.
 *
 * UN COMPOSANT, DEUX ROUTES, comme `ThreadScreen` : le texte est le même
 * des deux côtés, le lien de RETOUR ne l'est pas. Un commerçant qui lit les
 * conditions depuis `/vendeur/boutique` doit y revenir, pas atterrir dans
 * son espace d'acheteur. `backHref` est donc IMPOSÉ par la route qui monte
 * ce fichier, jamais lu dans l'URL — un paramètre se perd (favori, lien
 * partagé, retour arrière), un chemin se perd moins.
 *
 * AUCUNE GARDE ICI, et il n'y a rien à garder : ce composant ne lit aucune
 * donnée. `/conditions` est PUBLIQUE comme le catalogue — l'article 25 dit
 * que l'utilisateur accepte ces conditions en créant un compte, les cacher
 * derrière une inscription ferait accepter un texte qu'on ne peut pas lire
 * avant. `/vendeur/conditions` hérite de la garde de son espace : ce n'est
 * pas une restriction sur le texte, seulement sur ce chemin-là.
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

          {CONDITIONS.map((article) => (
            <section key={article.numero} className="flex flex-col gap-2.5">
              <h2 className="text-base font-semibold">
                {article.numero}. {article.titre}
              </h2>
              {article.blocs.map((bloc, i) =>
                /* Un tableau est une liste à puces, une chaîne est un
                   paragraphe. L'index sert de clé parce que ce texte est
                   figé dans un fichier : il ne se réordonne pas à
                   l'exécution, et deux paragraphes peuvent être
                   identiques (« Makiti peut : » apparaît trois fois). */
                Array.isArray(bloc) ? (
                  <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 text-base leading-relaxed">
                    {bloc.map((puce) => (
                      <li key={puce}>{puce}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} className="text-base leading-relaxed">
                    {bloc}
                  </p>
                ),
              )}
            </section>
          ))}

          <p className="text-sm text-ink-soft">{CONDITIONS_PIED}</p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
