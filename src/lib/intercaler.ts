/**
 * Place les produits sponsorisés PARMI les produits ordinaires : le premier
 * en tête, puis un tous les `pas` produits ordinaires, pour qu'ils soient
 * vus sans former un bloc d'annonces (décision du 2026-11-07 : 5 à
 * l'accueil, 3 en recherche et en catégorie). S'il n'y a pas assez de
 * produits ordinaires, les sponsorisés restants suivent à la fin.
 */
export function intercaler<A, B>(sponsorises: A[], ordinaires: B[], pas = 4): ({ sponsorise: A } | { ordinaire: B })[] {
  const sortie: ({ sponsorise: A } | { ordinaire: B })[] = [];
  let s = 0;
  ordinaires.forEach((o, i) => {
    if (i % pas === 0 && s < sponsorises.length) sortie.push({ sponsorise: sponsorises[s++] });
    sortie.push({ ordinaire: o });
  });
  while (s < sponsorises.length) sortie.push({ sponsorise: sponsorises[s++] });
  return sortie;
}
