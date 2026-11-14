import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { jourEtHeure } from "@/components/admin/EtatAnnonce";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { traiterSignalementAction } from "@/lib/actions/moderation";
import { cn } from "@/lib/cn";
import { formatMessageTime } from "@/lib/format";
import type { MessageSignale, Signalement } from "@/lib/data/moderation";
import { TexteAvecLiens } from "@/components/ui/TexteAvecLiens";

type Suite = { valeur: string; libelle: string; aide: string; profil?: string };

/**
 * Un signalement et ses suites possibles. Le motif est OBLIGATOIRE pour une
 * sanction (décision du 2026-11-06) : la personne suspendue le lit sur
 * `/compte/suspendu`. Pour une conversation, les 50 derniers messages
 * s'affichent : le signaleur a été prévenu que l'équipe la lirait.
 */
export function SignalementVue({
  s,
  messages,
  erreur,
}: {
  s: Signalement;
  messages: MessageSignale[];
  erreur?: string;
}) {
  const produit = s.target_type === "product";
  const suites: Suite[] = [{ valeur: "sans_suite", libelle: "Classer sans suite", aide: "Rien de contraire aux règles." }];
  if (produit) {
    suites.push({ valeur: "produit_masque", libelle: "Masquer le produit", aide: "Il quitte le catalogue ; la boutique reste ouverte." });
    if (s.merchant_profile_id) {
      suites.push({
        valeur: "compte_suspendu",
        libelle: `Suspendre la boutique ${s.shop_name ?? ""}`.trim(),
        aide: "Elle quitte le catalogue et ne peut plus écrire.",
        profil: s.merchant_profile_id,
      });
    }
  } else {
    if (s.conv_merchant_profile_id) {
      suites.push({
        valeur: "compte_suspendu",
        libelle: `Suspendre la boutique ${s.conv_shop_name ?? ""}`.trim(),
        aide: "Elle quitte le catalogue et ne peut plus écrire.",
        profil: s.conv_merchant_profile_id,
      });
    }
    if (s.conv_client_profile_id) {
      suites.push({
        valeur: "compte_suspendu",
        libelle: `Suspendre le client ${s.conv_client_nom ?? ""}`.trim(),
        aide: "Il ne peut plus envoyer de messages.",
        profil: s.conv_client_profile_id,
      });
    }
  }

  const nomDe = (id: string) =>
    id === s.conv_merchant_profile_id ? (s.conv_shop_name ?? "Boutique") : (s.conv_client_nom ?? "Client");

  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/moderation" title="Signalement" />
      <ScreenBody>
        <Section className="gap-5">
          {erreur ? <Notice>{erreur}</Notice> : null}

          <Card padded className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warn">{produit ? "Produit" : "Conversation"}</Badge>
              <span className="text-2xs text-ink-soft">
                {jourEtHeure(s.created_at)} · par {s.reporter_nom ?? "un utilisateur"}
              </span>
            </div>
            {produit ? (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-base font-semibold">
                  {s.produit_titre ?? "Produit supprimé"}
                  {s.shop_name ? ` · ${s.shop_name}` : ""}
                </span>
                {s.produit_status === "hidden" ? <Badge tone="danger">Masqué</Badge> : null}
                {s.produit_titre && s.produit_status !== "hidden" ? (
                  <Link
                    href={`/produit/${s.target_id}`}
                    target="_blank"
                    aria-label="Voir la fiche du produit"
                    className="flex size-tap items-center justify-center text-ink-soft"
                  >
                    <ExternalLink size={18} strokeWidth={2} aria-hidden />
                  </Link>
                ) : null}
              </div>
            ) : (
              <span className="text-base font-semibold">
                {s.conv_client_nom ?? "Client"} ↔ {s.conv_shop_name ?? "Boutique"}
              </span>
            )}
            <p className="text-sm leading-normal whitespace-pre-wrap">{s.reason}</p>
          </Card>

          {!produit ? (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Conversation · {messages.length} derniers messages</SectionLabel>
              <Card padded className="flex flex-col gap-2.5">
                {messages.length === 0 ? <p className="text-sm text-ink-soft">Aucun message.</p> : null}
                {messages.map((m) => {
                  const boutique = m.sender_id === s.conv_merchant_profile_id;
                  return (
                    <div key={m.id} className={cn("flex flex-col gap-0.5", boutique ? "items-end" : "items-start")}>
                      <span className="text-2xs text-ink-soft">
                        {nomDe(m.sender_id)} · {formatMessageTime(m.created_at)}
                      </span>
                      <p
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                          boutique ? "bg-accent-soft" : "border border-line bg-surface",
                        )}
                      >
                        <TexteAvecLiens texte={m.body} />
                      </p>
                    </div>
                  );
                })}
              </Card>
            </div>
          ) : null}

          <Card padded>
            <form action={traiterSignalementAction} className="flex flex-col gap-4">
              <input type="hidden" name="signalement" value={s.id} />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Suite donnée</legend>
                {suites.map((suite, i) => (
                  <label key={`${suite.valeur}-${suite.profil ?? ""}`} className="cursor-pointer">
                    {/* Un seul groupe de boutons radio : la valeur porte la suite ET le compte visé. */}
                    <input
                      type="radio"
                      name="choix"
                      value={`${suite.valeur}:${suite.profil ?? ""}`}
                      defaultChecked={i === 0}
                      className="peer sr-only"
                    />
                    <span className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5 peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:shadow-focus">
                      <span className="text-sm font-semibold">{suite.libelle}</span>
                      <span className="text-2xs text-ink-soft">{suite.aide}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <Field
                label="Motif"
                htmlFor="motif"
                hint="Obligatoire pour masquer ou suspendre. Une suspension montre ce motif à la personne : écrivez-le pour elle."
              >
                <Textarea id="motif" name="motif" rows={3} maxLength={500} placeholder="Ex. : Photos d'un autre vendeur" />
              </Field>
              <PendingSubmit className="flex h-control w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-on-accent">
                Valider
              </PendingSubmit>
            </form>
          </Card>
        </Section>
      </ScreenBody>
    </Screen>
  );
}
