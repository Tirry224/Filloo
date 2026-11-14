import { decouperLiens, lienInterne } from "@/lib/liens";

/**
 * Le texte d'un message, ses liens cliquables (voir `decouperLiens`).
 * À ne pas poser dans un élément déjà cliquable (aperçu d'une liste qui
 * ouvre le fil) : un lien dans un lien est invalide.
 *
 * `nofollow ugc` : le lien est écrit par un utilisateur, Filloo ne le
 * recommande pas. `noopener noreferrer` : la page ouverte ne peut ni
 * toucher l'onglet de Filloo ni lire l'adresse de la conversation.
 */
export function TexteAvecLiens({ texte }: { texte: string }) {
  return (
    <>
      {decouperLiens(texte).map((m, i) =>
        m.lien ? (
          <a
            key={i}
            href={m.lien}
            {...(lienInterne(m.lien) ? {} : { target: "_blank", rel: "noopener noreferrer nofollow ugc" })}
            className="break-all underline underline-offset-2"
          >
            {m.texte}
          </a>
        ) : (
          m.texte
        ),
      )}
    </>
  );
}
