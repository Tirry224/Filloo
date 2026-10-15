"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";

/**
 * Le message qui part, affiché AVANT la réponse du serveur.
 *
 * Sans lui, rien ne bougeait entre l'appui sur « Envoyer » et le retour de
 * l'action : le champ se vidait et le fil restait figé plusieurs secondes
 * (constaté le 2026-10-15). La bulle apparaît tout de suite, en « Envoi… »,
 * puis la vraie bulle du serveur la remplace au même endroit.
 *
 * Un seul texte à la fois : `useFormulaire` n'accepte qu'un envoi à la fois.
 */
type EnvoiEnCours = { texte: string | null; annoncer: (texte: string | null) => void };

const Contexte = createContext<EnvoiEnCours | null>(null);

export function EnvoiEnCoursProvider({ children }: { children: ReactNode }) {
  const [texte, annoncer] = useState<string | null>(null);
  return <Contexte value={{ texte, annoncer }}>{children}</Contexte>;
}

/** Hors d'un fournisseur, l'annonce ne fait rien : le Composer marche seul. */
export function useAnnoncerEnvoi(): (texte: string | null) => void {
  return useContext(Contexte)?.annoncer ?? (() => {});
}

export function MessageEnCours() {
  const texte = useContext(Contexte)?.texte ?? null;

  useEffect(() => {
    if (!texte) return;
    const page = document.scrollingElement ?? document.documentElement;
    window.scrollTo({ top: page.scrollHeight, behavior: "smooth" });
  }, [texte]);

  if (!texte) return null;
  return (
    <div className="flex flex-col opacity-70" aria-live="polite">
      <MessageBubble message={{ id: "envoi-en-cours", mine: true, product: null, body: texte, sentAt: "Envoi…" }} />
    </div>
  );
}
