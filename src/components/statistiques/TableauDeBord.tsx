import Link from "next/link";
import { AlertTriangle, CheckCheck, Eye, Info, MessageCircle, UserPlus } from "lucide-react";
import { EnTeteOnglet, Tuile } from "@/components/admin/AdminTopBar";
import { Card } from "@/components/ui/Card";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { cn } from "@/lib/cn";
import { PERIODES, lireChiffres, lireConnexions, type Chiffres, type Connexions, type Periode } from "@/lib/data/statistiques";

/**
 * Le tableau de bord de Filloo : ce qui se passe, sans écrire de SQL.
 * Monté par `/admin/statistiques`, pour toute l'équipe (0042). Il
 * remplace `/suivi`, supprimée le 2026-11-05 à la demande du porteur du
 * projet.
 *
 * Il lit en `service_role` (`lib/data/statistiques.ts`) : la page qui le monte
 * DOIT avoir vérifié qui regarde avant de le rendre.
 *
 * Depuis le 2026-11-05, les robots et les préchargements ne sont plus
 * comptés (`lib/robots-detecte.ts`) : avant cette date, visites et
 * recherches en contiennent beaucoup.
 */
export async function TableauDeBord({ base, periode }: { base: string; periode: Periode }) {
  const depuis = new Date(Date.now() - PERIODES[periode].heures * 3600 * 1000);
  const [c, connexions] = await Promise.all([lireChiffres(depuis), lireConnexions(depuis)]);
  return <TableauDeBordVue base={base} periode={periode} depuis={depuis} c={c} connexions={connexions} />;
}

/** L'affichage seul, sans lecture : la page de test visuel le monte avec des chiffres fictifs. */
export function TableauDeBordVue({
  base,
  periode,
  depuis,
  c,
  connexions,
}: {
  base: string;
  periode: Periode;
  depuis: Date;
  c: Chiffres;
  connexions: Connexions;
}) {

  const ev = (nom: string) => c.evenements[nom] ?? { total: 0, anon: 0, client: 0, merchant: 0 };
  const contacts = ev("contact_ouvert").total + ev("whatsapp_ouvert").total;

  const aTraiter: [number, string][] = [
    [c.signalements.a_traiter, "signalement(s) à traiter dans Supabase (table reports)"],
    [c.messagerie.sans_reponse, "conversation(s) où le vendeur n'a jamais répondu (plus de 24 h)"],
    [c.messagerie.non_lus_24h, "message(s) non lu(s) depuis plus de 24 h"],
    [connexions.nonConfirmees, "inscription(s) jamais confirmée(s) par email"],
    [c.boutiques.sans_produit, "boutique(s) ouverte(s) sans aucun produit publié"],
    [c.notifications.en_echec, "notification(s) en échec d'envoi"],
  ];
  const alertes = aTraiter.filter(([n]) => n > 0);
  const jours = joursDeLaPeriode(c.par_jour, depuis);

  return (
    <ScreenBody>
      <Section className="gap-5">
        <EnTeteOnglet titre="Statistiques" sousTitre="Ce qui se passe sur Filloo, sans écrire de SQL." />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Période" className="inline-flex rounded-full border border-line bg-surface p-1">
            {(Object.keys(PERIODES) as Periode[]).map((p) => (
              <Link
                key={p}
                href={`${base}?periode=${p}`}
                aria-current={p === periode ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                  p === periode ? "bg-accent text-on-accent" : "text-ink-soft",
                )}
              >
                {PERIODES[p].libelle}
              </Link>
            ))}
          </nav>
          <span className="text-2xs text-ink-soft">Mis à jour à {heure(new Date())}, heure de Conakry</span>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-accent-soft px-3.5 py-2.5 text-xs text-accent-hover">
          <Info size={15} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
          Robots et préchargements exclus depuis le 5 novembre 2026 : avant cette date, visites et recherches sont
          gonflées. Comparez les périodes postérieures entre elles.
        </p>

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Tuile icone={Eye} valeur={ev("visite").total} libelle="visites de l'accueil" forte />
          <Tuile icone={Eye} valeur={ev("produit_vu").total} libelle="fiches produit vues" />
          <Tuile icone={MessageCircle} valeur={contacts} libelle="clics Contacter ou WhatsApp" />
          <Tuile icone={UserPlus} valeur={connexions.nouvelles} libelle="inscriptions" />
        </div>

        {alertes.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-success bg-success-soft px-3.5 py-3 text-sm text-success-ink">
            <CheckCheck size={18} strokeWidth={2} aria-hidden />
            Rien à traiter pour le moment.
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-warn bg-warn-soft px-3.5 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-warn-ink">
              <AlertTriangle size={17} strokeWidth={2} aria-hidden />À traiter
            </span>
            <ul className="flex flex-col gap-1.5">
              {alertes.map(([n, texte]) => (
                <li key={texte} className="flex items-baseline gap-2.5 text-sm text-ink">
                  <span className="min-w-7 font-bold text-warn-ink tabular-nums">{n}</span>
                  <span>{texte}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Visites de l&apos;accueil, jour par jour</h2>
            <span className="text-xs text-ink-soft tabular-nums">{ev("visite").total} au total</span>
          </div>
          <Barres jours={jours} />
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Voir le détail jour par jour</span>
              <span className="hidden group-open:inline">Masquer le détail</span>
            </summary>
            <table className="mt-3 w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="py-2 pr-2 font-medium">Jour</th>
                  <th className="px-2 py-2 text-right font-medium">Visites</th>
                  <th className="px-2 py-2 text-right font-medium">Produits</th>
                  <th className="px-2 py-2 text-right font-medium">Contacts</th>
                  <th className="px-2 py-2 text-right font-medium">Inscr.</th>
                  <th className="py-2 pl-2 text-right font-medium">Msg</th>
                </tr>
              </thead>
              <tbody>
                {[...jours].reverse().map((j) => (
                  <tr key={j.jour} className="border-b border-line last:border-0">
                    <td className="py-2 pr-2">{jour(j.jour)}</td>
                    <td className="px-2 py-2 text-right">{j.visites}</td>
                    <td className="px-2 py-2 text-right">{j.produits_vus}</td>
                    <td className="px-2 py-2 text-right">{j.contacts}</td>
                    <td className="px-2 py-2 text-right">{j.inscriptions}</td>
                    <td className="py-2 pl-2 text-right">{j.messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          <Bloc titre="Parcours des visiteurs" note="Une visite n'est comptée qu'à l'accueil : arriver par un lien de produit compte dans « Fiches produit vues ».">
            <Ligne libelle="Fiches boutique vues" valeur={ev("boutique_vue").total} />
            <Ligne libelle="Recherches" valeur={ev("recherche").total} />
            <Ligne libelle="Clics « Contacter »" valeur={ev("contact_ouvert").total} detail={`dont ${ev("contact_ouvert").anon} sans compte`} />
            <Ligne libelle="Clics WhatsApp" valeur={ev("whatsapp_ouvert").total} detail={`dont ${ev("whatsapp_ouvert").anon} sans compte`} />
            <Ligne libelle="Conversations ouvertes" valeur={ev("contact_abouti").total} />
            <Ligne
              libelle="Messages envoyés"
              valeur={ev("message_envoye").total}
              detail={`${n(ev("message_envoye").client, "client")} · ${n(ev("message_envoye").merchant, "vendeur")}`}
            />
          </Bloc>

          <Bloc titre="Comptes">
            <Ligne libelle="Personnes connectées sur la période" valeur={connexions.actives} />
            <Ligne
              libelle="Nouveaux comptes"
              valeur={connexions.nouvelles}
              detail={`${n(c.profils.nouveaux_clients, "client")} · ${n(c.profils.nouveaux_commercants, "vendeur")}`}
            />
            <Ligne libelle="Comptes au total" valeur={connexions.total} />
            <Ligne libelle="Profils clients · vendeurs" valeur={c.profils.clients + c.profils.commercants} detail={`${n(c.profils.clients, "client")} · ${n(c.profils.commercants, "vendeur")}`} />
            <Ligne libelle="Emails jamais confirmés" valeur={connexions.nonConfirmees} />
            <Ligne libelle="Suspendus · supprimés" valeur={c.profils.suspendus + c.profils.supprimes} detail={`${n(c.profils.suspendus, "suspendu")} · ${n(c.profils.supprimes, "supprimé")}`} />
          </Bloc>

          <Bloc titre="Boutiques et produits">
            <Ligne libelle="Boutiques" valeur={c.boutiques.total} detail={`${n(c.boutiques.nouvelles, "nouvelle")} sur la période`} />
            <Ligne libelle="Boutiques sans produit" valeur={c.boutiques.sans_produit} />
            <Ligne libelle="Boutiques sans photo" valeur={c.boutiques.sans_photo} />
            <Ligne libelle="Produits en ligne" valeur={c.produits.en_ligne} detail={`${n(c.produits.nouveaux, "nouveau", "nouveaux")} sur la période`} />
            <Ligne libelle="Vendus · masqués · brouillons" valeur={c.produits.vendus + c.produits.masques + c.produits.brouillons} detail={`${n(c.produits.vendus, "vendu")} · ${n(c.produits.masques, "masqué")} · ${n(c.produits.brouillons, "brouillon")}`} />
          </Bloc>

          <Bloc titre="Messagerie et signalements">
            <Ligne libelle="Nouvelles conversations" valeur={c.messagerie.nouvelles_conversations} detail={`${c.messagerie.conversations} au total`} />
            <Ligne libelle="Messages sur la période" valeur={c.messagerie.messages} />
            <Ligne libelle="Vendeur jamais répondu" valeur={c.messagerie.sans_reponse} />
            <Ligne libelle="Conversations bloquées" valeur={c.messagerie.bloquees} />
            <Ligne
              libelle="Signalements à traiter"
              valeur={c.signalements.a_traiter}
              detail={`${n(c.signalements.produits, "produit")} · ${n(c.signalements.boutiques, "boutique")} · ${n(c.signalements.conversations, "conversation")}`}
            />
            <Ligne libelle="Téléphones abonnés aux notifications" valeur={c.notifications.abonnements_push} />
          </Bloc>

          <Bloc titre="Recherches sans résultat" note="Ce que les gens cherchent sans le trouver : les vendeurs à recruter.">
            <ListeMots mots={c.recherches_vides} vide="Aucune sur la période." />
          </Bloc>

          <Bloc titre="Recherches les plus fréquentes">
            <ListeMots mots={c.recherches} vide="Aucune sur la période." />
          </Bloc>
        </div>

        <p className="text-center text-2xs text-ink-soft">
          Les erreurs techniques ne sont pas ici : elles se lisent dans Vercel, onglet Logs du projet filloo.
        </p>
      </Section>
    </ScreenBody>
  );
}

function Bloc({ titre, note, children }: { titre: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <div className="px-4 pt-3.5 pb-1">
        <SectionLabel>{titre}</SectionLabel>
      </div>
      <div className="flex flex-col">{children}</div>
      {note ? <p className="border-t border-line px-4 py-2.5 text-2xs text-ink-soft">{note}</p> : null}
    </Card>
  );
}

function Ligne({ libelle, valeur, detail }: { libelle: string; valeur: number; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{libelle}</span>
        {detail ? <span className="text-2xs text-ink-soft">{detail}</span> : null}
      </div>
      <span className="text-base font-bold tabular-nums">{valeur}</span>
    </div>
  );
}

/** Les mots et leur fréquence, avec une barre fine : la longueur dit l'ordre de grandeur, le chiffre le dit exactement. */
function ListeMots({ mots, vide }: { mots: { mots: string; fois: number; vides?: number }[]; vide: string }) {
  if (mots.length === 0) return <p className="px-4 py-3 text-sm text-ink-soft">{vide}</p>;
  const max = Math.max(...mots.map((m) => m.fois), 1);
  return (
    <ul className="flex flex-col gap-2.5 px-4 py-3">
      {mots.map((m) => (
        <li key={m.mots} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{m.mots}</span>
            <span className="shrink-0 text-ink-soft tabular-nums">
              {m.fois}
              {m.vides ? ` · ${m.vides} sans résultat` : ""}
            </span>
          </div>
          <div className="h-1 rounded-full bg-paper" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max((m.fois / max) * 100, 3)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type Jour = Chiffres["par_jour"][number];

/** Chaque jour de la période, y compris ceux sans aucun événement (absents du SQL), du plus ancien au plus récent. */
function joursDeLaPeriode(parJour: Jour[], depuis: Date): Jour[] {
  const connus = new Map(parJour.map((j) => [j.jour, j]));
  const jours: Jour[] = [];
  const curseur = new Date(Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate()));
  const fin = new Date();
  while (curseur <= fin) {
    const cle = curseur.toISOString().slice(0, 10);
    jours.push(connus.get(cle) ?? { jour: cle, visites: 0, produits_vus: 0, contacts: 0, inscriptions: 0, messages: 0 });
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
}

/**
 * Une barre par jour, ancrée en bas, extrémité arrondie, 2 px d'écart :
 * une seule série, donc une seule teinte et pas de légende (le titre la
 * nomme). Le survol donne le chiffre exact ; le tableau en dessous reste
 * la lecture sans souris.
 */
function Barres({ jours }: { jours: Jour[] }) {
  const max = Math.max(...jours.map((j) => j.visites), 1);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="relative flex h-32 items-end gap-0.5 border-b border-line-strong">
        <span className="pointer-events-none absolute top-0 left-0 text-2xs text-ink-soft tabular-nums">{max}</span>
        {jours.map((j) => (
          <div
            key={j.jour}
            title={`${jour(j.jour)} : ${j.visites} visite${j.visites > 1 ? "s" : ""}`}
            className="group relative flex h-full flex-1 items-end"
          >
            <div
              className="mx-auto w-full max-w-7 rounded-t-xs bg-accent group-hover:bg-accent-hover"
              style={{ height: j.visites ? `${Math.max((j.visites / max) * 100, 2)}%` : "0" }}
            />
          </div>
        ))}
      </div>
      {premier && dernier ? (
        <figcaption className="flex justify-between text-2xs text-ink-soft">
          <span>{jour(premier.jour)}</span>
          {premier !== dernier ? <span>{jour(dernier.jour)}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** « 1 vendeur », « 2 vendeurs » ; 0 au pluriel, comme en français courant. */
function n(nombre: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${nombre} ${nombre === 1 ? singulier : pluriel}`;
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
