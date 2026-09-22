/**
 * Le rendu commun aux deux textes juridiques : conditions d'utilisation et
 * politique de confidentialité.
 *
 * Extrait de `TermsScreen` le jour où la politique de confidentialité est
 * arrivée avec exactement la même forme — un numéro, un titre, des blocs
 * qui sont soit des paragraphes soit des listes à puces. Deux copies de ce
 * JSX auraient divergé à la première correction de mise en page, et c'est
 * le texte non corrigé qui aurait fini par être lu.
 */

/** Un bloc est soit un paragraphe, soit une liste à puces. */
export type Bloc = string | string[];

export type Article = {
  /** Numéroté comme dans le texte d'origine : on s'y réfère dans un
   *  échange, donc la numérotation ne se recalcule pas. */
  numero: number;
  titre: string;
  blocs: Bloc[];
};

export function Articles({ articles }: { articles: readonly Article[] }) {
  return (
    <>
      {articles.map((article) => (
        <section key={article.numero} className="flex flex-col gap-2.5">
          <h2 className="text-base font-semibold">
            {article.numero}. {article.titre}
          </h2>
          {article.blocs.map((bloc, i) =>
            /* Tableau = liste à puces, chaîne = paragraphe. L'index sert de
               clé : le texte est figé, jamais réordonné, et deux
               paragraphes peuvent être identiques. */
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
    </>
  );
}
