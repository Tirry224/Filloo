/** Pas dans les types DOM de TypeScript : l'événement n'est pas standard. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let evenement: BeforeInstallPromptEvent | null = null;
const abonnes = new Set<() => void>();

function prevenir() {
  abonnes.forEach((abonne) => abonne());
}

/* Chrome n'émet `beforeinstallprompt` qu'une fois par chargement de
   document, souvent sur un écran sans carte d'installation : l'écoute doit
   vivre au niveau du module, chargé sur toutes les pages, pour que la
   carte le retrouve après une navigation côté client. */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    evenement = e as BeforeInstallPromptEvent;
    prevenir();
  });
  window.addEventListener("appinstalled", () => {
    evenement = null;
    prevenir();
  });
}

export function abonnerInstallation(abonne: () => void) {
  abonnes.add(abonne);
  return () => {
    abonnes.delete(abonne);
  };
}

export function evenementInstallation() {
  return evenement;
}

/** L'événement ne sert qu'une fois. */
export function oublierEvenementInstallation() {
  evenement = null;
  prevenir();
}
