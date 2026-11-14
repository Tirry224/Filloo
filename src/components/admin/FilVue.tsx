import { Megaphone, SendHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, ScreenFooter } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { repondreAuFilAction } from "@/lib/actions/equipe";
import { cn } from "@/lib/cn";
import { formatMessageTime } from "@/lib/format";
import { TexteAvecLiens } from "@/components/ui/TexteAvecLiens";

export type MessageDuFil = {
  id: string;
  auteur_id: string | null;
  de_l_equipe: boolean;
  corps: string;
  created_at: string;
  annonces: { titre: string } | null;
};

/** Le fil, affichage seul (données lues par `admin/(plein-ecran)/fil/[id]/page.tsx`). */
export function FilVue({
  id,
  espace,
  nom,
  messages,
  nomDe,
  erreur,
  profil,
}: {
  id: string;
  espace: "client" | "merchant";
  nom: string;
  messages: MessageDuFil[];
  nomDe: Map<string, string>;
  erreur?: string;
  /** Fil encore vide : le compte visé, pour rouvrir cette page après une erreur. */
  profil?: string;
}) {
  return (
    <Screen largeur="rangees">
      <TopBar
        backHref="/admin"
        title={
          <div className="flex items-center gap-3">
            <Avatar name={nom} size={38} kind={espace === "merchant" ? "shop" : "person"} />
            <span className="flex flex-col">
              <span className="text-base font-semibold">{nom}</span>
              <span className="text-2xs text-ink-soft">
                {espace === "merchant" ? "Espace boutique" : "Espace client"} · conversation avec l&apos;équipe
              </span>
            </span>
          </div>
        }
      />

      <ScreenBody className="justify-end">
        <div className="flex flex-col gap-2.5 p-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-ink-soft">
              Aucun message encore. Écrivez le premier : {nom} le lira dans « Équipe Filloo » et recevra une notification.
            </p>
          ) : null}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.de_l_equipe ? "items-end" : "items-start")}>
              {m.annonces ? (
                <span className="flex max-w-[80%] items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-2xs font-medium text-accent-hover">
                  <Megaphone size={12} strokeWidth={2} aria-hidden />
                  <span className="truncate">En réponse à « {m.annonces.titre} »</span>
                </span>
              ) : null}
              <div
                className={cn(
                  "flex max-w-[80%] flex-col gap-0.5 px-3 pt-2.5 pb-2",
                  m.de_l_equipe
                    ? "rounded-lg rounded-br-xs bg-accent text-on-accent"
                    : "rounded-lg rounded-bl-xs border border-line bg-surface",
                )}
              >
                <p className="text-base leading-normal whitespace-pre-wrap"><TexteAvecLiens texte={m.corps} /></p>
                <time className={cn("self-end text-2xs", m.de_l_equipe ? "text-on-accent/75" : "text-ink-soft")}>
                  {m.de_l_equipe ? `${(m.auteur_id && nomDe.get(m.auteur_id)) || "Équipe"} · ` : ""}
                  {formatMessageTime(m.created_at)}
                </time>
              </div>
            </div>
          ))}
        </div>
      </ScreenBody>

      <ScreenFooter className="flex flex-col gap-2">
        {erreur ? <Notice>{erreur}</Notice> : null}
        <form action={repondreAuFilAction} className="flex items-center gap-2.5">
          <input type="hidden" name="filDe" value={id} />
          <input type="hidden" name="espace" value={espace} />
          {profil ? <input type="hidden" name="profil" value={profil} /> : null}
          <input
            name="corps"
            maxLength={2000}
            required
            autoComplete="off"
            aria-label="Votre réponse"
            placeholder={messages.length ? `Répondre à ${nom}` : `Écrire à ${nom}`}
            className="h-tap flex-1 rounded-full border border-line bg-surface px-4 text-base"
          />
          <button
            type="submit"
            aria-label="Envoyer"
            className="flex size-tap shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent"
          >
            <SendHorizontal size={20} strokeWidth={1.9} aria-hidden />
          </button>
        </form>
        <p className="text-center text-2xs text-ink-soft">
          {nom} verra « Équipe Filloo » et recevra une notification.
        </p>
      </ScreenFooter>
    </Screen>
  );
}
