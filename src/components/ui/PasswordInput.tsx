"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/**
 * Un mot de passe qu'on peut afficher : sur un clavier de téléphone, une
 * faute de frappe invisible coûtait un échec de connexion sans savoir
 * pourquoi (demande du porteur du projet, 2026-10-23). Masqué par défaut :
 * l'écran peut être vu par quelqu'un d'autre.
 *
 * Le bouton est `type="button"` : un bouton dans un formulaire l'envoie
 * sinon. L'état ne quitte jamais le navigateur ; le serveur reçoit le même
 * champ, affiché ou non.
 */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const Icone = visible ? EyeOff : Eye;

  return (
    <div className={classes.cadre}>
      <Input {...props} type={visible ? "text" : "password"} className={cn(classes.champ, className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className={classes.bouton}
      >
        <Icone size={20} strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}

const classes = {
  cadre: "relative",
  // Place pour le bouton, sans que le texte passe dessous.
  champ: "pr-12",
  bouton: "absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-soft",
};
