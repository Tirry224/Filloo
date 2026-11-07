import { LogOut } from "lucide-react";
import { PushBell } from "@/components/push/PushBell";
import { Badge } from "@/components/ui/Badge";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { signOutAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * L'en-tête des onglets de l'équipe. La cloche y est INDISPENSABLE : un
 * compte de l'équipe n'a que `/admin` (0043), donc nulle part ailleurs où
 * activer les notifications qui l'avertissent d'un message. La
 * déconnexion aussi : c'est sa seule sortie.
 *
 * Le badge dit « Propriétaire » au propriétaire de Filloo (0067), « Équipe »
 * aux autres : la base répond, pas le jeton. En cas d'échec, « Équipe ».
 */
export async function AdminTopBar() {
  const supabase = await createClient();
  const { data: proprietaire } = await supabase.rpc("je_suis_proprietaire");
  return (
    <TopBar
      title={
        <span className="flex items-center gap-2">
          <Wordmark />
          <Badge tone="accent" className="self-center">
            {proprietaire ? "Propriétaire" : "Équipe"}
          </Badge>
        </span>
      }
      right={
        <>
          <PushBell connecte />
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Se déconnecter"
              className="-mr-2 flex size-tap cursor-pointer items-center justify-center rounded-full text-black"
            >
              <LogOut size={20} strokeWidth={2.5} aria-hidden />
            </button>
          </form>
        </>
      }
    />
  );
}

/** Le titre d'un onglet, sous l'en-tête : comme « Bonjour, … » de l'espace commerçant. */
export function EnTeteOnglet({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="font-display text-xl font-bold">{titre}</h1>
      <p className="text-sm text-ink-soft">{sousTitre}</p>
    </div>
  );
}

/** Une tuile chiffrée, comme « Votre activité » de l'espace commerçant. */
export function Tuile({
  icone: Icone,
  valeur,
  libelle,
  forte = false,
}: {
  icone: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;
  valeur: number | string;
  libelle: string;
  forte?: boolean;
}) {
  return (
    <div
      className={
        forte
          ? "flex h-full flex-col gap-0.5 rounded-lg border border-accent bg-accent-soft p-3"
          : "flex h-full flex-col gap-0.5 rounded-lg border border-line bg-surface p-3"
      }
    >
      <Icone size={18} strokeWidth={1.9} className={forte ? "text-accent-hover" : "text-ink-soft"} aria-hidden />
      <span className={forte ? "font-display text-2xl font-bold text-accent-hover" : "font-display text-2xl font-bold"}>
        {valeur}
      </span>
      <span className={forte ? "text-2xs font-medium text-accent-hover" : "text-2xs text-ink-soft"}>{libelle}</span>
    </div>
  );
}
