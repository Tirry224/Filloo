import Link from "next/link";
import { ChevronRight, History, MessageSquareWarning, Package, ShieldCheck, UserRoundX } from "lucide-react";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { jourEtHeure } from "@/components/admin/EtatAnnonce";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { reactiverCompteAction } from "@/lib/actions/moderation";
import type { CompteSuspendu, Signalement } from "@/lib/data/moderation";

/**
 * L'onglet Modération de l'équipe (0046) : ce qui a été signalé et attend
 * une suite, les comptes suspendus qu'on peut réactiver, et l'accès à
 * l'historique de ce que l'équipe a fait.
 */
export function ModerationVue({
  signalements,
  suspendus,
  erreur,
  info,
}: {
  signalements: Signalement[];
  suspendus: CompteSuspendu[];
  erreur?: string;
  info?: string;
}) {
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet
            titre="Modération"
            sousTitre="Les signalements à traiter et les comptes suspendus. Chaque geste est signé dans l'historique."
          />
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          <div className="flex flex-col gap-2.5">
            <SectionLabel>À traiter · {signalements.length}</SectionLabel>
            {signalements.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Rien à traiter" description="Les nouveaux signalements apparaîtront ici." />
            ) : (
              signalements.map((s) => <LigneSignalement key={s.id} s={s} />)
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Comptes suspendus · {suspendus.length}</SectionLabel>
            {suspendus.length === 0 ? (
              <p className="text-sm text-ink-soft">Aucun compte suspendu.</p>
            ) : (
              suspendus.map((c) => <LigneSuspendu key={c.profile_id} c={c} />)
            )}
          </div>

          <Link href="/admin/moderation/historique">
            <Card className="flex items-center gap-3 p-3.5">
              <History size={20} strokeWidth={1.9} className="shrink-0 text-ink-soft" aria-hidden />
              <span className="flex-1 text-base font-semibold">Historique de l&apos;équipe</span>
              <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
            </Card>
          </Link>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}

function LigneSignalement({ s }: { s: Signalement }) {
  const produit = s.target_type === "product";
  const Icone = produit ? Package : MessageSquareWarning;
  const sujet = produit
    ? `${s.produit_titre ?? "Produit supprimé"}${s.shop_name ? ` · ${s.shop_name}` : ""}`
    : `Conversation ${s.conv_client_nom ?? "Client"} ↔ ${s.conv_shop_name ?? "Boutique"}`;
  return (
    <Link href={`/admin/signalement/${s.id}`}>
      <Card className="flex items-center gap-3 p-3.5">
        <Icone size={20} strokeWidth={1.9} className="shrink-0 text-ink-soft" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warn">{produit ? "Produit" : "Conversation"}</Badge>
            <span className="text-2xs text-ink-soft">{jourEtHeure(s.created_at)}</span>
          </div>
          <span className="truncate text-base font-semibold">{sujet}</span>
          <p className="line-clamp-2 text-sm text-ink-soft">{s.reason}</p>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
      </Card>
    </Link>
  );
}

/** Le motif de réactivation reste interne : il sert l'historique, la personne ne le voit pas. */
function LigneSuspendu({ c }: { c: CompteSuspendu }) {
  return (
    <Card padded className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <UserRoundX size={20} strokeWidth={1.9} className="shrink-0 text-danger" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold">{c.shop_name ?? c.nom ?? "Compte"}</span>
          <span className="text-2xs text-ink-soft">{c.role === "merchant" ? "Boutique" : "Client"}</span>
        </div>
      </div>
      {c.suspension_reason ? <p className="text-sm text-ink-soft">Motif : {c.suspension_reason}</p> : null}
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-accent-hover">Réactiver ce compte</summary>
        <form action={reactiverCompteAction} className="mt-2.5 flex flex-col gap-2">
          <input type="hidden" name="profil" value={c.profile_id} />
          <label className="sr-only" htmlFor={`motif-${c.profile_id}`}>
            Motif de la réactivation
          </label>
          <input
            id={`motif-${c.profile_id}`}
            name="motif"
            required
            minLength={3}
            maxLength={500}
            placeholder="Pourquoi réactiver (interne à l'équipe)"
            className="h-tap rounded-lg border border-line bg-surface px-3.5 text-base"
          />
          <PendingSubmit className="flex h-tap w-full cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-base font-semibold text-ink">
            Réactiver
          </PendingSubmit>
        </form>
      </details>
    </Card>
  );
}
