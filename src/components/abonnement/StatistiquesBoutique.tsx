import Link from "next/link";
import { Eye, Lock, MessageCircle, Store } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { JourStat, ProduitVu, Tendance } from "@/lib/data/abonnements";

const jourCourt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Les quatre totaux de la période et le graphique des vues (formules Pro et Business, 0049). */
export function ResumeStatistiques({ jours, titre }: { jours: JourStat[]; titre: string }) {
  const total = (k: keyof Omit<JourStat, "jour">) => jours.reduce((s, j) => s + j[k], 0);
  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>{titre}</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        <Tuile icone={<Store size={18} strokeWidth={1.9} aria-hidden />} valeur={total("boutiqueVues")} libelle="visites de la boutique" />
        <Tuile icone={<Eye size={18} strokeWidth={1.9} aria-hidden />} valeur={total("produitsVus")} libelle="vues de vos produits" />
        <Tuile icone={<MessageCircle size={18} strokeWidth={1.9} aria-hidden />} valeur={total("contacts")} libelle="clics « Contacter »" />
        <Tuile icone={<WhatsAppIcon className="size-[18px]" />} valeur={total("whatsapp")} libelle="clics WhatsApp" />
      </div>
      <Card padded>
        <Barres jours={jours} />
      </Card>
    </div>
  );
}

function Tuile({ icone, valeur, libelle }: { icone: React.ReactNode; valeur: number; libelle: string }) {
  return (
    <Card className="flex flex-col gap-0.5 p-3">
      <span className="text-ink-soft">{icone}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{valeur}</span>
      <span className="text-2xs text-ink-soft">{libelle}</span>
    </Card>
  );
}

/**
 * Une barre par jour : les vues des produits et de la boutique, additionnées
 * (une seule série, une seule teinte). Le survol donne le chiffre exact.
 */
function Barres({ jours }: { jours: JourStat[] }) {
  const valeur = (j: JourStat) => j.produitsVus + j.boutiqueVues;
  const max = Math.max(...jours.map(valeur), 1);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-sm font-semibold">Vues par jour</figcaption>
      <div className="relative flex h-28 items-end gap-0.5 border-b border-line-strong">
        <span className="pointer-events-none absolute top-0 left-0 text-2xs text-ink-soft tabular-nums">{max}</span>
        {jours.map((j) => (
          <div key={j.jour} title={`${jourCourt(j.jour)} : ${valeur(j)} vue${valeur(j) > 1 ? "s" : ""}`} className="flex h-full flex-1 items-end">
            <div
              className="mx-auto w-full max-w-6 rounded-t-xs bg-accent"
              style={{ height: valeur(j) ? `${Math.max((valeur(j) / max) * 100, 2)}%` : "0" }}
            />
          </div>
        ))}
      </div>
      {premier && dernier ? (
        <div className="flex justify-between text-2xs text-ink-soft">
          <span>{jourCourt(premier.jour)}</span>
          <span>{jourCourt(dernier.jour)}</span>
        </div>
      ) : null}
    </figure>
  );
}

export function ProduitsLesPlusVus({ produits }: { produits: ProduitVu[] }) {
  if (produits.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>Vos produits les plus vus</SectionLabel>
      <Card className="divide-y divide-line">
        {produits.map((p) => (
          <Link key={p.id} href={`/produit/${p.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
            <span className="truncate font-semibold">{p.titre}</span>
            <span className="shrink-0 text-ink-soft tabular-nums">
              {p.vues} vues · {p.contacts} contacts
            </span>
          </Link>
        ))}
      </Card>
    </div>
  );
}

const GENRES: Record<Tendance["genre"], { titre: string; vide: string }> = {
  recherche: { titre: "Ce que les clients cherchent", vide: "Pas encore assez de recherches." },
  recherche_sans_resultat: { titre: "Cherché, mais introuvable sur Filloo", vide: "Rien de notable : les clients trouvent ce qu'ils cherchent." },
  categorie: { titre: "Catégories les plus regardées", vide: "Pas encore assez de visites." },
};

/**
 * Les tendances de tout Filloo (Business) : agrégées, jamais les chiffres
 * d'une autre boutique. « Introuvable » est le plus utile : ce que des
 * clients veulent et que personne ne vend encore.
 */
export function TendancesFilloo({ tendances }: { tendances: Tendance[] }) {
  return (
    <>
      {(Object.keys(GENRES) as Tendance["genre"][]).map((g) => {
        const liste = tendances.filter((t) => t.genre === g);
        return (
          <div key={g} className="flex flex-col gap-2.5">
            <SectionLabel>{GENRES[g].titre}</SectionLabel>
            {liste.length === 0 ? (
              <p className="text-sm text-ink-soft">{GENRES[g].vide}</p>
            ) : (
              <Card className="divide-y divide-line">
                {liste.map((t) => (
                  <div key={t.libelle} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="truncate">{t.libelle}</span>
                    <span className="shrink-0 text-ink-soft tabular-nums">{t.total}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Ce qu'un compte Gratuit voit à la place : ce qu'il obtiendrait, sans faux chiffres. */
export function InvitationPro() {
  return (
    <Link href="/vendeur/abonnement">
      <Card padded className="flex items-start gap-3">
        <Lock size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden />
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">Vos statistiques avec Pro</span>
          <span className="text-sm text-ink-soft">
            Visites de votre boutique, vues de vos produits, clics WhatsApp, jour par jour. Et des produits illimités.
          </span>
        </span>
      </Card>
    </Link>
  );
}
