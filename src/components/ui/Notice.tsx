/**
 * Bandeau d'erreur affiché EN HAUT d'un écran, après une action qui a
 * échoué ailleurs (une feuille d'actions, typiquement).
 *
 * Le message transite par `?erreur=` et non par `useActionState`, qui
 * rendrait cliente chaque feuille : les lignes (`ActionRow`) sont de
 * vraies `<form>` serveur, utilisables sans JavaScript.
 *
 * SÉCURITÉ : ce texte vient donc de l'URL. React l'échappe, mais n'importe
 * qui peut fabriquer un lien affichant le message de son choix —
 * acceptable pour un bandeau qui informe, PAS pour une valeur qui
 * déclencherait une action.
 */
export function Notice({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "success" }) {
  if (!children) return null;

  return (
    <p
      role="status"
      className={
        tone === "danger"
          ? "rounded-md border border-danger bg-danger-soft px-3.5 py-3 text-sm text-danger"
          : "rounded-md border border-success bg-success-soft px-3.5 py-3 text-sm text-success-ink"
      }
    >
      {children}
    </p>
  );
}
