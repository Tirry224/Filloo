import Link from "next/link";
import { ChevronRight, FolderTree, Package, Search, Store, UserRound, UsersRound } from "lucide-react";
import { AdminTopBar, EnTeteOnglet } from "@/components/admin/AdminTopBar";
import { jourEtHeure } from "@/components/admin/EtatAnnonce";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PendingSubmit } from "@/components/ui/PendingSubmit";
import { Screen, ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import {
  ajouterMembreAction,
  demasquerProduitAction,
  fixerCategorieAction,
  fixerVilleAction,
  masquerProduitGestionAction,
  reactiverCompteGestionAction,
  retirerCategorieAction,
  retirerMembreAction,
  retirerVilleAction,
  suspendreCompteAction,
} from "@/lib/actions/gestion";
import {
  FILTRES_PRODUITS,
  type Categorie,
  type CompteGere,
  type FiltreProduits,
  type Membre,
  type ProduitGere,
  type Ville,
} from "@/lib/data/gestion";

/**
 * `/admin/gestion` (décision du porteur du projet, 2026-11-07 : tout le
 * site s'administre depuis `/admin`). Comptes, produits, équipe,
 * catégories et villes : ce qui demandait encore Supabase.
 */

const CHAMP = "h-tap w-full rounded-lg border border-line bg-surface px-3.5 text-base";
const BOUTON = "flex h-tap w-full cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-base font-semibold text-ink";
const BOUTON_FORT = "flex h-tap w-full cursor-pointer items-center justify-center rounded-lg bg-accent text-base font-semibold text-white";
const BOUTON_DANGER = "flex h-tap w-full cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-base font-semibold text-danger";

type Messages = { erreur?: string; info?: string };

function Avis({ erreur, info }: Messages) {
  return (
    <>
      {erreur ? <Notice>{erreur}</Notice> : null}
      {info ? <Notice tone="success">{info}</Notice> : null}
    </>
  );
}

/* ---------- L'onglet ---------- */

const RUBRIQUES = [
  { href: "/admin/gestion/comptes", icone: UserRound, titre: "Comptes et boutiques", texte: "Chercher un client ou une boutique, suspendre, réactiver." },
  { href: "/admin/gestion/produits", icone: Package, titre: "Produits", texte: "Chercher un produit, le masquer ou le démasquer." },
  { href: "/admin/gestion/equipe", icone: UsersRound, titre: "Équipe", texte: "Ajouter ou retirer un collaborateur." },
  { href: "/admin/gestion/catalogue", icone: FolderTree, titre: "Catégories et villes", texte: "Ajouter, renommer, ordonner, retirer." },
] as const;

export function GestionAccueilVue() {
  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet titre="Gestion" sousTitre="Tout le site, sans passer par Supabase. Chaque geste est signé dans l'historique." />
          <div className="flex flex-col gap-2.5">
            {RUBRIQUES.map((r) => (
              <Link key={r.href} href={r.href}>
                <Card className="flex items-center gap-3 p-3.5">
                  <r.icone size={20} strokeWidth={1.9} className="shrink-0 text-ink-soft" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-semibold">{r.titre}</span>
                    <span className="text-sm text-ink-soft">{r.texte}</span>
                  </div>
                  <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
                </Card>
              </Link>
            ))}
          </div>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}

function Recherche({ action, valeur, placeholder, children }: { action: string; valeur: string; placeholder: string; children?: React.ReactNode }) {
  return (
    <form action={action} method="get" role="search" className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="q">
          Rechercher
        </label>
        <input id="q" name="q" defaultValue={valeur} placeholder={placeholder} maxLength={80} className={CHAMP} />
        <button type="submit" aria-label="Rechercher" className="flex size-tap shrink-0 cursor-pointer items-center justify-center rounded-lg bg-accent text-white">
          <Search size={20} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
      {children}
    </form>
  );
}

/** Un geste avec motif obligatoire, replié tant qu'on ne l'ouvre pas. */
function GesteAvecMotif({
  libelle,
  action,
  champ,
  valeur,
  retour,
  placeholder,
  bouton,
  danger = false,
}: {
  libelle: string;
  action: (formData: FormData) => Promise<void>;
  champ: string;
  valeur: string;
  retour: string;
  placeholder: string;
  bouton: string;
  danger?: boolean;
}) {
  const id = `${champ}-${valeur}-${bouton}`;
  return (
    <details>
      <summary className={`cursor-pointer text-sm font-semibold ${danger ? "text-danger" : "text-accent-hover"}`}>{libelle}</summary>
      <form action={action} className="mt-2.5 flex flex-col gap-2">
        <input type="hidden" name={champ} value={valeur} />
        <input type="hidden" name="retour" value={retour} />
        <label className="sr-only" htmlFor={id}>
          Motif
        </label>
        <input id={id} name="motif" required minLength={3} maxLength={500} placeholder={placeholder} className={CHAMP} />
        <PendingSubmit className={danger ? BOUTON_DANGER : BOUTON}>{bouton}</PendingSubmit>
      </form>
    </details>
  );
}

/* ---------- Comptes ---------- */

export function ComptesVue({ comptes, recherche, ...m }: { comptes: CompteGere[]; recherche: string | null } & Messages) {
  const retour = `/admin/gestion/comptes${recherche ? `?q=${encodeURIComponent(recherche)}` : ""}`;
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/gestion" title="Comptes et boutiques" />
      <ScreenBody>
        <Section className="gap-4">
          <Avis {...m} />
          <Recherche action="/admin/gestion/comptes" valeur={recherche ?? ""} placeholder="Nom, boutique, téléphone ou email" />
          <SectionLabel>{recherche ? `Résultats · ${comptes.length}` : `Les plus récents · ${comptes.length}`}</SectionLabel>
          {comptes.length === 0 ? (
            <EmptyState icon={UserRound} title="Aucun compte" description="Essayez un autre nom, un numéro ou une adresse." />
          ) : (
            comptes.map((c) => <LigneCompte key={c.profile_id} c={c} retour={retour} />)
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function LigneCompte({ c, retour }: { c: CompteGere; retour: string }) {
  const boutique = c.role === "merchant";
  const Icone = boutique ? Store : UserRound;
  return (
    <Card padded className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <Icone size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold">{c.shop_name ?? c.nom ?? "Sans nom"}</span>
            <Badge tone={boutique ? "accent" : "neutral"}>{boutique ? "Boutique" : "Client"}</Badge>
            {c.is_deleted ? <Badge>Supprimé</Badge> : c.is_suspended ? <Badge tone="warn">Suspendu</Badge> : null}
          </div>
          {boutique && c.nom ? <span className="text-sm text-ink-soft">{c.nom}</span> : null}
          <span className="text-sm text-ink-soft">
            {[c.telephone, c.email, c.ville].filter(Boolean).join(" · ") || "Aucune coordonnée"}
          </span>
          <span className="text-2xs text-ink-soft">
            Inscrit le {jourEtHeure(c.created_at)}
            {boutique ? ` · ${c.produits} produit${Number(c.produits) > 1 ? "s" : ""}` : ""}
            {Number(c.signalements_en_attente) > 0 ? ` · ${c.signalements_en_attente} signalement(s) en attente` : ""}
          </span>
          {c.is_suspended && c.suspension_reason ? <p className="text-sm text-ink-soft">Motif : {c.suspension_reason}</p> : null}
        </div>
      </div>
      {boutique && c.shop_name ? (
        <Link href={`/admin/gestion/produits?q=${encodeURIComponent(c.shop_name)}`} className="text-sm font-semibold text-accent-hover">
          Voir ses produits
        </Link>
      ) : null}
      {c.is_deleted ? null : c.is_suspended ? (
        <GesteAvecMotif
          libelle="Réactiver ce compte"
          action={reactiverCompteGestionAction}
          champ="profil"
          valeur={c.profile_id}
          retour={retour}
          placeholder="Pourquoi réactiver (interne à l'équipe)"
          bouton="Réactiver"
        />
      ) : (
        <GesteAvecMotif
          libelle="Suspendre ce compte"
          action={suspendreCompteAction}
          champ="profil"
          valeur={c.profile_id}
          retour={retour}
          placeholder="Motif, montré à la personne"
          bouton="Suspendre"
          danger
        />
      )}
    </Card>
  );
}

/* ---------- Produits ---------- */

const STATUTS: Record<string, string> = { active: "En ligne", sold: "Vendu", hidden: "Masqué", draft: "Brouillon" };

export function ProduitsVue({
  produits,
  recherche,
  filtre,
  ...m
}: { produits: ProduitGere[]; recherche: string | null; filtre: FiltreProduits } & Messages) {
  const params = new URLSearchParams();
  if (recherche) params.set("q", recherche);
  if (filtre !== "tous") params.set("statut", filtre);
  const retour = `/admin/gestion/produits${params.size ? `?${params}` : ""}`;
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/gestion" title="Produits" />
      <ScreenBody>
        <Section className="gap-4">
          <Avis {...m} />
          <Recherche action="/admin/gestion/produits" valeur={recherche ?? ""} placeholder="Titre ou nom de boutique">
            <label className="sr-only" htmlFor="statut">
              Statut
            </label>
            <select id="statut" name="statut" defaultValue={filtre} className={CHAMP}>
              {Object.entries(FILTRES_PRODUITS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Recherche>
          <SectionLabel>{`Produits · ${produits.length}`}</SectionLabel>
          {produits.length === 0 ? (
            <EmptyState icon={Package} title="Aucun produit" description="Changez la recherche ou le statut." />
          ) : (
            produits.map((p) => <LigneProduit key={p.product_id} p={p} retour={retour} />)
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function LigneProduit({ p, retour }: { p: ProduitGere; retour: string }) {
  return (
    <Card padded className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-base font-semibold">{p.titre}</span>
          {p.masque_par_equipe ? <Badge tone="warn">Masqué par l&apos;équipe</Badge> : <Badge>{STATUTS[p.statut] ?? p.statut}</Badge>}
        </div>
        <span className="text-sm text-ink-soft">
          {[p.shop_name, p.categorie, p.prix != null ? `${Number(p.prix).toLocaleString("fr-FR")} GNF` : null].filter(Boolean).join(" · ")}
        </span>
        <span className="text-2xs text-ink-soft">Publié le {jourEtHeure(p.created_at)}</span>
      </div>
      {p.statut === "active" ? (
        <Link href={`/produit/${p.product_id}`} className="text-sm font-semibold text-accent-hover">
          Voir la fiche
        </Link>
      ) : null}
      {p.masque_par_equipe ? (
        <GesteAvecMotif
          libelle="Démasquer ce produit"
          action={demasquerProduitAction}
          champ="produit"
          valeur={p.product_id}
          retour={retour}
          placeholder="Pourquoi démasquer (interne à l'équipe)"
          bouton="Démasquer"
        />
      ) : (
        <GesteAvecMotif
          libelle="Masquer ce produit"
          action={masquerProduitGestionAction}
          champ="produit"
          valeur={p.product_id}
          retour={retour}
          placeholder="Motif du masquage"
          bouton="Masquer"
          danger
        />
      )}
    </Card>
  );
}

/* ---------- Équipe ---------- */

export function EquipeVue({ membres, ...m }: { membres: Membre[] } & Messages) {
  const retour = "/admin/gestion/equipe";
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/gestion" title="Équipe" />
      <ScreenBody>
        <Section className="gap-5">
          <Avis {...m} />
          <div className="flex flex-col gap-2.5">
            <SectionLabel>{`Membres · ${membres.length}`}</SectionLabel>
            {membres.map((u) => (
              <Card key={u.auth_user_id} padded className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{u.nom}</span>
                  {u.moi ? <Badge tone="accent">Vous</Badge> : null}
                </div>
                <span className="text-sm text-ink-soft">{u.email ?? "Adresse inconnue"}</span>
                <span className="text-2xs text-ink-soft">Membre depuis le {jourEtHeure(u.created_at)}</span>
                {u.moi ? null : (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-danger">Retirer de l&apos;équipe</summary>
                    <form action={retirerMembreAction} className="mt-2.5 flex flex-col gap-2">
                      <input type="hidden" name="membre" value={u.auth_user_id} />
                      <input type="hidden" name="retour" value={retour} />
                      <p className="text-sm text-ink-soft">
                        {u.nom} perdra l&apos;accès à /admin ; ses messages passés restent dans les fils.
                      </p>
                      <PendingSubmit className={BOUTON_DANGER}>Retirer {u.nom}</PendingSubmit>
                    </form>
                  </details>
                )}
              </Card>
            ))}
          </div>

          <Card padded className="flex flex-col gap-2.5">
            <h2 className="text-base font-semibold">Ajouter un membre</h2>
            <p className="text-sm text-ink-soft">
              La personne doit d&apos;abord avoir un compte Filloo confirmé. Une fois membre, son compte ne voit plus que
              /admin : il lui faut une autre adresse pour acheter ou vendre.
            </p>
            <form action={ajouterMembreAction} className="flex flex-col gap-2">
              <input type="hidden" name="retour" value={retour} />
              <label className="text-sm font-medium" htmlFor="email">
                Adresse email de son compte
              </label>
              <input id="email" name="email" type="email" required maxLength={254} className={CHAMP} />
              <label className="text-sm font-medium" htmlFor="nom">
                Prénom affiché aux collègues
              </label>
              <input id="nom" name="nom" required maxLength={60} className={CHAMP} />
              <PendingSubmit className={BOUTON_FORT}>Ajouter</PendingSubmit>
            </form>
          </Card>
        </Section>
      </ScreenBody>
    </Screen>
  );
}

/* ---------- Catégories et villes ---------- */

export function CatalogueVue({ categories, villes, ...m }: { categories: Categorie[]; villes: Ville[] } & Messages) {
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/gestion" title="Catégories et villes" />
      <ScreenBody>
        <Section className="gap-6">
          <Avis {...m} />
          <Liste
            titre="Catégories"
            elements={categories.map((c) => ({ id: c.id, nom: c.name, position: c.position }))}
            fixer={fixerCategorieAction}
            retirer={retirerCategorieAction}
            note="Renommer garde l'adresse de la catégorie (et l'app la suit). Une catégorie qui a des produits ne se retire pas."
          />
          <Liste
            titre="Villes"
            elements={villes.map((v) => ({ id: v.id, nom: v.name, position: v.position }))}
            fixer={fixerVilleAction}
            retirer={retirerVilleAction}
            note="Une ville utilisée par une boutique, un compte ou un produit ne se retire pas."
          />
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function Liste({
  titre,
  elements,
  fixer,
  retirer,
  note,
}: {
  titre: string;
  elements: { id: number; nom: string; position: number }[];
  fixer: (formData: FormData) => Promise<void>;
  retirer: (formData: FormData) => Promise<void>;
  note: string;
}) {
  const retour = "/admin/gestion/catalogue";
  const cle = titre.toLowerCase();
  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>{`${titre} · ${elements.length}`}</SectionLabel>
      <p className="text-sm text-ink-soft">{note} L&apos;ordre : le plus petit nombre en premier.</p>
      {elements.map((e) => (
        <Card key={e.id} padded className="flex flex-col gap-2">
          <form action={fixer} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="retour" value={retour} />
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <label className="text-2xs text-ink-soft" htmlFor={`${cle}-nom-${e.id}`}>
                Nom
              </label>
              <input id={`${cle}-nom-${e.id}`} name="nom" defaultValue={e.nom} required minLength={2} maxLength={40} className={CHAMP} />
            </div>
            <div className="flex w-24 flex-col gap-1">
              <label className="text-2xs text-ink-soft" htmlFor={`${cle}-pos-${e.id}`}>
                Ordre
              </label>
              <input id={`${cle}-pos-${e.id}`} name="position" type="number" min={0} max={9999} defaultValue={e.position} className={CHAMP} />
            </div>
            <PendingSubmit className="flex h-tap cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 text-base font-semibold text-ink">
              Enregistrer
            </PendingSubmit>
          </form>
          <form action={retirer}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="retour" value={retour} />
            <PendingSubmit className="cursor-pointer text-sm font-semibold text-danger">Retirer</PendingSubmit>
          </form>
        </Card>
      ))}
      <Card padded>
        <form action={fixer} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="retour" value={retour} />
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <label className="text-2xs text-ink-soft" htmlFor={`${cle}-nouveau`}>
              Ajouter
            </label>
            <input id={`${cle}-nouveau`} name="nom" required minLength={2} maxLength={40} placeholder="Nom" className={CHAMP} />
          </div>
          <div className="flex w-24 flex-col gap-1">
            <label className="text-2xs text-ink-soft" htmlFor={`${cle}-nouveau-pos`}>
              Ordre
            </label>
            <input id={`${cle}-nouveau-pos`} name="position" type="number" min={0} max={9999} placeholder="Fin" className={CHAMP} />
          </div>
          <PendingSubmit className="flex h-tap cursor-pointer items-center justify-center rounded-lg bg-accent px-4 text-base font-semibold text-white">
            Ajouter
          </PendingSubmit>
        </form>
      </Card>
    </div>
  );
}
