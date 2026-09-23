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
