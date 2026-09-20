/**
 * Bandeau d'erreur affiché EN HAUT d'un écran, après une action qui a
 * échoué ailleurs (une feuille d'actions, typiquement).
 *
 * Le message transite par `?erreur=` et non par `useActionState` : les
 * lignes de feuille (`ActionRow`) sont de vraies `<form>` serveur, ce qui
 * les fait marcher sans JavaScript sur un réseau guinéen instable
 * (docs/REPRISE.md, étape 2) ; `useActionState` rendrait chaque feuille
 * cliente.
 *
 * SÉCURITÉ : ce texte vient donc de l'URL, donc de l'utilisateur. React
 * l'échappe (pas d'injection), mais n'importe qui peut fabriquer un lien
 * affichant le message de son choix. Acceptable pour un bandeau qui ne
 * fait qu'informer ; PAS pour une valeur qui déclencherait une action.
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
