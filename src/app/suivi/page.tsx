import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { getSessionUser } from "@/lib/data/session";
import {
  PERIODES,
  estProprietaire,
  lireChiffres,
  lireConnexions,
  lirePeriode,
  type Periode,
} from "@/lib/data/suivi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Suivi",
  robots: { index: false, follow: false },
};

/* À la requête : la garde lit la session, et des chiffres figés au build
   ne diraient rien. */
export const dynamic = "force-dynamic";

/**
 * L'écran du porteur du projet : ce qui se passe dans Filloo, sans écrire
 * de SQL. Pour TOUS les autres, cette page n'existe pas — `notFound()` et
 * non un refus, pour ne pas dire qu'il y a ici quelque chose à forcer.
 */
export default async function SuiviPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!estProprietaire(user)) notFound();

  const periode = lirePeriode((await searchParams).periode);
  const depuis = new Date(Date.now() - PERIODES[periode].heures * 3600 * 1000);
  const [c, connexions] = await Promise.all([lireChiffres(depuis), lireConnexions(depuis)]);

  const ev = (nom: string) => c.evenements[nom] ?? { total: 0, anon: 0, client: 0, merchant: 0 };

  const aTraiter: [number, string][] = [
    [c.signalements.a_traiter, "signalement(s) à traiter dans Supabase (table reports)"],
    [c.boutiques.en_attente, "boutique(s) en attente de validation"],
    [c.messagerie.sans_reponse, "conversation(s) où le vendeur n'a jamais répondu (plus de 24 h)"],
    [c.messagerie.non_lus_24h, "message(s) non lu(s) depuis plus de 24 h"],
    [connexions.nonConfirmees, "inscription(s) jamais confirmée(s) par e-mail"],
    [c.boutiques.sans_produit, "boutique(s) ouverte(s) sans aucun produit publié"],
    [c.notifications.en_echec, "notification(s) en échec d'envoi"],
  ];
  const alertes = aTraiter.filter(([n]) => n > 0);

  return (
    <Screen largeur="rangees">
      <TopBar title="Suivi" backHref="/" />
      <ScreenBody>
        <Section>
          <nav aria-label="Période" className="flex gap-2">
            {(Object.keys(PERIODES) as Periode[]).map((p) => (
              <Link
                key={p}
                href={`/suivi?periode=${p}`}
                className={cn(
                  "rounded-full border px-3 py-2 text-sm font-medium",
                  p === periode ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
                )}
              >
                {PERIODES[p].libelle}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-ink-soft">
            Période : les {PERIODES[periode].libelle} écoulés. Mis à jour à chaque ouverture de la page (heure de
            Conakry : {heure(new Date())}).
          </p>
        </Section>

        <Section>
          <SectionLabel>À traiter maintenant</SectionLabel>
          <Card padded>
            {alertes.length === 0 ? (
              <p className="text-sm text-ink-soft">Rien en attente.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alertes.map(([n, texte]) => (
                  <li key={texte} className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-8 font-bold text-warn-ink tabular-nums">{n}</span>
                    <span>{texte}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>

        <Section>
          <SectionLabel>Parcours des visiteurs</SectionLabel>
          <Card>
            <Ligne libelle="Visites de l'accueil" valeur={ev("visite").total} />
            <Ligne libelle="Fiches produit vues" valeur={ev("produit_vu").total} />
            <Ligne libelle="Fiches boutique vues" valeur={ev("boutique_vue").total} />
            <Ligne libelle="Recherches" valeur={ev("recherche").total} />
            <Ligne
              libelle="Clics « Contacter »"
              valeur={ev("contact_ouvert").total}
              detail={`dont ${ev("contact_ouvert").anon} sans compte`}
            />
            <Ligne
              libelle="Clics WhatsApp"
              valeur={ev("whatsapp_ouvert").total}
              detail={`dont ${ev("whatsapp_ouvert").anon} sans compte`}
            />
            <Ligne libelle="Conversations ouvertes" valeur={ev("contact_abouti").total} />
            <Ligne
              libelle="Messages envoyés"
              valeur={ev("message_envoye").total}
              detail={`${ev("message_envoye").client} clients · ${ev("message_envoye").merchant} vendeurs`}
            />
          </Card>
          <p className="text-xs text-ink-soft">
            Une visite n&apos;est comptée qu&apos;à l&apos;accueil : quelqu&apos;un qui arrive directement sur un
            lien de produit apparaît dans « Fiches produit vues ».
          </p>
        </Section>

        <Section>
          <SectionLabel>Comptes</SectionLabel>
          <Card>
            <Ligne libelle="Inscriptions sur la période" valeur={connexions.nouvelles} />
            <Ligne libelle="dont comptes clients" valeur={c.profils.nouveaux_clients} />
            <Ligne libelle="dont comptes vendeurs" valeur={c.profils.nouveaux_commercants} />
            <Ligne libelle="Personnes connectées sur la période" valeur={connexions.actives} />
            <Ligne libelle="Comptes au total" valeur={connexions.total} />
            <Ligne libelle="Profils clients" valeur={c.profils.clients} />
            <Ligne libelle="Profils vendeurs" valeur={c.profils.commercants} />
            <Ligne libelle="E-mails jamais confirmés" valeur={connexions.nonConfirmees} />
            <Ligne libelle="Profils suspendus" valeur={c.profils.suspendus} />
            <Ligne libelle="Comptes supprimés" valeur={c.profils.supprimes} />
          </Card>
        </Section>

        <Section>
          <SectionLabel>Boutiques et produits</SectionLabel>
          <Card>
            <Ligne libelle="Boutiques au total" valeur={c.boutiques.total} />
            <Ligne libelle="Nouvelles boutiques" valeur={c.boutiques.nouvelles} />
            <Ligne libelle="Boutiques sans produit" valeur={c.boutiques.sans_produit} />
            <Ligne libelle="Boutiques sans photo" valeur={c.boutiques.sans_photo} />
            <Ligne libelle="Produits en ligne" valeur={c.produits.en_ligne} />
            <Ligne libelle="Nouveaux produits" valeur={c.produits.nouveaux} />
            <Ligne libelle="Produits vendus" valeur={c.produits.vendus} />
            <Ligne libelle="Produits masqués" valeur={c.produits.masques} />
            <Ligne libelle="Brouillons" valeur={c.produits.brouillons} />
          </Card>
        </Section>

        <Section>
          <SectionLabel>Messagerie</SectionLabel>
          <Card>
            <Ligne libelle="Nouvelles conversations" valeur={c.messagerie.nouvelles_conversations} />
            <Ligne libelle="Messages sur la période" valeur={c.messagerie.messages} />
            <Ligne libelle="Conversations au total" valeur={c.messagerie.conversations} />
            <Ligne libelle="Vendeur jamais répondu" valeur={c.messagerie.sans_reponse} />
            <Ligne libelle="Conversations bloquées" valeur={c.messagerie.bloquees} />
          </Card>
        </Section>

        <Section>
          <SectionLabel>Recherches sans résultat</SectionLabel>
          <Card padded>
            {c.recherches_vides.length === 0 ? (
              <p className="text-sm text-ink-soft">Aucune sur la période.</p>
            ) : (
              <ListeMots mots={c.recherches_vides} />
            )}
          </Card>
          <p className="text-xs text-ink-soft">Ce que les gens cherchent sans le trouver : les vendeurs à recruter.</p>
        </Section>

        <Section>
          <SectionLabel>Recherches les plus fréquentes</SectionLabel>
          <Card padded>
            {c.recherches.length === 0 ? (
              <p className="text-sm text-ink-soft">Aucune sur la période.</p>
            ) : (
              <ListeMots mots={c.recherches} />
            )}
          </Card>
        </Section>

        <Section>
          <SectionLabel>Jour par jour</SectionLabel>
          <Card>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-3 py-2 font-medium">Jour</th>
                  <th className="px-2 py-2 text-right font-medium">Visites</th>
                  <th className="px-2 py-2 text-right font-medium">Produits</th>
                  <th className="px-2 py-2 text-right font-medium">Contacts</th>
                  <th className="px-2 py-2 text-right font-medium">Inscr.</th>
                  <th className="px-3 py-2 text-right font-medium">Msg</th>
                </tr>
              </thead>
              <tbody>
                {c.par_jour.map((j) => (
                  <tr key={j.jour} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{jour(j.jour)}</td>
                    <td className="px-2 py-2 text-right">{j.visites}</td>
                    <td className="px-2 py-2 text-right">{j.produits_vus}</td>
                    <td className="px-2 py-2 text-right">{j.contacts}</td>
                    <td className="px-2 py-2 text-right">{j.inscriptions}</td>
                    <td className="px-3 py-2 text-right">{j.messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>

        <Section>
          <SectionLabel>Signalements et notifications</SectionLabel>
          <Card>
            <Ligne libelle="Signalements à traiter" valeur={c.signalements.a_traiter} />
            <Ligne
              libelle="dont produits / boutiques / conversations"
              valeur={c.signalements.produits + c.signalements.boutiques + c.signalements.conversations}
              detail={`${c.signalements.produits} / ${c.signalements.boutiques} / ${c.signalements.conversations}`}
            />
            <Ligne libelle="Nouveaux signalements" valeur={c.signalements.nouveaux} />
            <Ligne libelle="Téléphones abonnés aux notifications" valeur={c.notifications.abonnements_push} />
            <Ligne libelle="Notifications en attente d'envoi" valeur={c.notifications.en_attente} />
            <Ligne libelle="Notifications en échec" valeur={c.notifications.en_echec} />
          </Card>
          <p className="text-xs text-ink-soft">
            Les erreurs techniques (pages qui plantent) ne sont pas ici : elles se lisent dans Vercel, onglet Logs
            du projet filloo.
          </p>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function Ligne({ libelle, valeur, detail }: { libelle: string; valeur: number; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm">{libelle}</span>
        {detail ? <span className="text-xs text-ink-soft">{detail}</span> : null}
      </div>
      <span className="text-base font-bold tabular-nums">{valeur}</span>
    </div>
  );
}

function ListeMots({ mots }: { mots: { mots: string; fois: number; vides?: number }[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {mots.map((m) => (
        <li key={m.mots} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate">{m.mots}</span>
          <span className="shrink-0 tabular-nums text-ink-soft">
            {m.fois}
            {m.vides ? ` (${m.vides} sans résultat)` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* Conakry vit en UTC toute l'année : l'heure du serveur Vercel (UTC) est
   donc la bonne, pourvu qu'on la lise en UTC. */
function heure(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function jour(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
