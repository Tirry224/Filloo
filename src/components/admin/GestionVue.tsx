import Link from "next/link";
import { ChevronRight, FolderTree, Package, Search, ShoppingBag, Store, UserRound, UsersRound } from "lucide-react";
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
  supprimerCompteAction,
  supprimerProduitEquipeAction,
  suspendreCompteAction,
} from "@/lib/actions/gestion";
import { productImageUrl, shopPhotoUrl } from "@/lib/storage";
import {
  ESPACES,
  FILTRES_PRODUITS,
  type Categorie,
  type CompteGere,
  type Espace,
  type FicheCompte,
  type FiltreProduits,
  type Membre,
  type ProduitBoutique,
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
  { href: "/admin/gestion/vendeurs", icone: Store, titre: "Vendeurs", texte: "Les boutiques : fiche complète, produits, suspendre, supprimer." },
  { href: "/admin/gestion/acheteurs", icone: ShoppingBag, titre: "Acheteurs", texte: "Les clients : fiche complète, suspendre, supprimer." },
  { href: "/admin/gestion/produits", icone: Package, titre: "Produits", texte: "Chercher un produit, le masquer, le démasquer ou le supprimer." },
  { href: "/admin/gestion/equipe", icone: UsersRound, titre: "Équipe", texte: "Les membres. Seul le propriétaire en ajoute ou en retire." },
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

/* ---------- Vendeurs et acheteurs ---------- */

/** La liste d'un espace : `/admin/gestion/vendeurs` ou `/admin/gestion/acheteurs`. */
function lienListe(espace: Espace, recherche: string | null): string {
  return `/admin/gestion/${espace}${recherche ? `?q=${encodeURIComponent(recherche)}` : ""}`;
}

export function ComptesVue({
  espace,
  comptes,
  recherche,
  ...m
}: { espace: Espace; comptes: CompteGere[]; recherche: string | null } & Messages) {
  const e = ESPACES[espace];
  return (
    <Screen largeur="rangees">
      <TopBar backHref="/admin/gestion" title={e.titre} />
      <ScreenBody>
        <Section className="gap-4">
          <Avis {...m} />
          <Recherche
            action={`/admin/gestion/${espace}`}
            valeur={recherche ?? ""}
            placeholder={espace === "vendeurs" ? "Boutique, nom, téléphone ou email" : "Nom, téléphone ou email"}
          />
          <SectionLabel>{recherche ? `Résultats · ${comptes.length}` : `Les plus récents · ${comptes.length}`}</SectionLabel>
          {comptes.length === 0 ? (
            <EmptyState
              icon={espace === "vendeurs" ? Store : UserRound}
              title={`Aucun ${e.un}`}
              description="Essayez un autre nom, un numéro ou une adresse."
            />
          ) : (
            comptes.map((c) => <LigneCompte key={c.profile_id} c={c} espace={espace} recherche={recherche} />)
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}

function EtatCompte({ supprime, suspendu }: { supprime: boolean; suspendu: boolean }) {
  if (supprime) return <Badge>Supprimé</Badge>;
  if (suspendu) return <Badge tone="warn">Suspendu</Badge>;
  return null;
}

/** Une ligne de liste : toute la carte ouvre la fiche. La recherche suit,
 *  pour que le retour de la fiche ramène à la même liste. */
function LigneCompte({ c, espace, recherche }: { c: CompteGere; espace: Espace; recherche: string | null }) {
  const boutique = espace === "vendeurs";
  const Icone = boutique ? Store : UserRound;
  const href = `/admin/gestion/${espace}/${c.profile_id}${recherche ? `?q=${encodeURIComponent(recherche)}` : ""}`;
  return (
    <Link href={href}>
      <Card className="flex items-center gap-3 p-3.5">
        <Icone size={20} strokeWidth={1.9} className="shrink-0 text-ink-soft" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold">{(boutique ? c.shop_name : null) ?? c.nom ?? "Sans nom"}</span>
            <EtatCompte supprime={c.is_deleted} suspendu={c.is_suspended} />
          </div>
          <span className="truncate text-sm text-ink-soft">
            {[boutique ? c.nom : null, c.telephone, c.email, c.ville].filter(Boolean).join(" · ") || "Aucune coordonnée"}
          </span>
          <span className="text-2xs text-ink-soft">
            Inscrit le {jourEtHeure(c.created_at)}
            {boutique ? ` · ${c.produits} produit${Number(c.produits) > 1 ? "s" : ""}` : ""}
            {Number(c.signalements_en_attente) > 0 ? ` · ${c.signalements_en_attente} signalement(s) en attente` : ""}
          </span>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
      </Card>
    </Link>
  );
}

const STATUTS_BOUTIQUE: Record<string, string> = { pending: "En attente de validation", approved: "Validée", rejected: "Refusée" };

function Info({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs text-ink-soft">{libelle}</dt>
      <dd className="text-base break-words">{valeur ?? <span className="text-ink-soft">—</span>}</dd>
    </div>
  );
}

/** Supprimer, avec case à cocher : le geste ne se défait pas. */
function GesteSuppression({
  libelle,
  action,
  champ,
  valeur,
  retour,
  avertissement,
  bouton,
}: {
  libelle: string;
  action: (formData: FormData) => Promise<void>;
  champ: string;
  valeur: string;
  retour: string;
  avertissement: string;
  bouton: string;
}) {
  const id = `suppr-${champ}-${valeur}`;
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-danger">{libelle}</summary>
      <form action={action} className="mt-2.5 flex flex-col gap-2">
        <input type="hidden" name={champ} value={valeur} />
        <input type="hidden" name="retour" value={retour} />
        <p className="text-sm text-ink-soft">{avertissement}</p>
        <label className="sr-only" htmlFor={`${id}-motif`}>
          Motif
        </label>
        <input id={`${id}-motif`} name="motif" required minLength={3} maxLength={500} placeholder="Motif (interne à l'équipe)" className={CHAMP} />
        <label className="flex items-center gap-2 text-sm" htmlFor={`${id}-ok`}>
          <input id={`${id}-ok`} type="checkbox" name="confirmer" value="oui" required className="size-5" />
          Je confirme : c&apos;est définitif.
        </label>
        <PendingSubmit className={BOUTON_DANGER}>{bouton}</PendingSubmit>
      </form>
    </details>
  );
}

export function FicheVue({
  espace,
  fiche,
  produits,
  recherche,
  ...m
}: { espace: Espace; fiche: FicheCompte; produits: ProduitBoutique[]; recherche: string | null } & Messages) {
  const boutique = espace === "vendeurs";
  const retour = `/admin/gestion/${espace}/${fiche.profile_id}${recherche ? `?q=${encodeURIComponent(recherche)}` : ""}`;
  const titre = (boutique ? fiche.shop_name : null) ?? fiche.nom ?? "Sans nom";
  return (
    <Screen largeur="rangees">
      <TopBar backHref={lienListe(espace, recherche)} title={titre} />
      <ScreenBody>
        <Section className="gap-5">
          <Avis {...m} />

          <Card padded className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {boutique && fiche.photo_path ? (
                <img src={shopPhotoUrl(fiche.photo_path)} alt="" className="size-14 shrink-0 rounded-full object-cover" />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={boutique ? "accent" : "neutral"}>{boutique ? "Vendeur" : "Acheteur"}</Badge>
                <EtatCompte supprime={fiche.is_deleted} suspendu={fiche.is_suspended} />
                {fiche.est_de_l_equipe ? <Badge tone="accent">Équipe Filloo</Badge> : null}
              </div>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Info libelle="Nom" valeur={fiche.nom} />
              <Info libelle="Téléphone" valeur={fiche.telephone} />
              <Info libelle="Email" valeur={fiche.email} />
              <Info libelle="Email confirmé" valeur={fiche.email_confirme_le ? jourEtHeure(fiche.email_confirme_le) : "Non"} />
              <Info libelle="Ville" valeur={fiche.ville} />
              <Info libelle="Inscrit le" valeur={jourEtHeure(fiche.created_at)} />
              <Info libelle="Dernière connexion" valeur={fiche.derniere_connexion ? jourEtHeure(fiche.derniere_connexion) : "Jamais"} />
              <Info libelle="Conversations" valeur={String(fiche.conversations)} />
              <Info libelle="Signalements en attente" valeur={String(fiche.signalements_en_attente)} />
              {fiche.is_suspended ? <Info libelle="Motif de la suspension" valeur={fiche.suspension_reason} /> : null}
              {fiche.is_deleted && fiche.deleted_at ? <Info libelle="Supprimé le" valeur={jourEtHeure(fiche.deleted_at)} /> : null}
            </dl>
            {boutique ? (
              <dl className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                <Info libelle="Boutique" valeur={fiche.shop_name} />
                <Info libelle="État de la boutique" valeur={fiche.statut_boutique ? STATUTS_BOUTIQUE[fiche.statut_boutique] ?? fiche.statut_boutique : null} />
                <Info libelle="WhatsApp" valeur={fiche.whatsapp_phone} />
                <Info libelle="Adresse" valeur={fiche.address_hint} />
                <Info libelle="Validée le" valeur={fiche.approved_at ? jourEtHeure(fiche.approved_at) : null} />
                {fiche.rejection_reason ? <Info libelle="Motif du refus" valeur={fiche.rejection_reason} /> : null}
                <div className="sm:col-span-2">
                  <Info libelle="Description" valeur={fiche.description} />
                </div>
              </dl>
            ) : null}
          </Card>

          {fiche.is_deleted ? null : (
            <Card padded className="flex flex-col gap-3">
              <Link
                href={`/admin/fil/${fiche.auth_user_id}?espace=${fiche.role}&profil=${fiche.profile_id}`}
                className={BOUTON_FORT}
              >
                Écrire à {boutique ? "cette boutique" : "cette personne"}
              </Link>
              {fiche.is_suspended ? (
                <GesteAvecMotif
                  libelle="Réactiver ce compte"
                  action={reactiverCompteGestionAction}
                  champ="profil"
                  valeur={fiche.profile_id}
                  retour={retour}
                  placeholder="Pourquoi réactiver (interne à l'équipe)"
                  bouton="Réactiver"
                />
              ) : (
                <GesteAvecMotif
                  libelle="Suspendre ce compte"
                  action={suspendreCompteAction}
                  champ="profil"
                  valeur={fiche.profile_id}
                  retour={retour}
                  placeholder="Motif, montré à la personne"
                  bouton="Suspendre"
                  danger
                />
              )}
              {fiche.est_de_l_equipe ? null : (
                <GesteSuppression
                  libelle="Supprimer ce compte"
                  action={supprimerCompteAction}
                  champ="profil"
                  valeur={fiche.profile_id}
                  retour={retour}
                  avertissement={
                    boutique
                      ? "Le nom, le téléphone, la photo et les coordonnées de la boutique sont effacés, ses produits retirés avec leurs photos. Les conversations restent lisibles pour les clients. Impossible à annuler."
                      : "Le nom et le téléphone sont effacés et la personne ne peut plus se connecter. Les conversations restent lisibles pour les boutiques. Impossible à annuler."
                  }
                  bouton="Supprimer définitivement"
                />
              )}
            </Card>
          )}

          {boutique ? (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>{`Produits publiés · ${produits.length}`}</SectionLabel>
              {produits.length === 0 ? (
                <EmptyState icon={Package} title="Aucun produit" description="Cette boutique n'a encore rien publié." />
              ) : (
                produits.map((p) => <LigneProduit key={p.product_id} p={{ ...p, shop_name: null }} retour={retour} photo={p.photo_path} />)
              )}
            </div>
          ) : null}
        </Section>
      </ScreenBody>
    </Screen>
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

type LigneDeProduit = Pick<ProduitGere, "product_id" | "titre" | "statut" | "prix" | "categorie" | "masque_par_equipe" | "created_at"> & {
  shop_name: string | null;
};

function LigneProduit({ p, retour, photo }: { p: LigneDeProduit; retour: string; photo?: string | null }) {
  return (
    <Card padded className="flex flex-col gap-2.5">
      <div className="flex gap-3">
      {photo !== undefined ? (
        photo ? (
          <img src={productImageUrl(photo)} alt="" loading="lazy" className="size-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-line/40 text-ink-soft">
            <Package size={20} strokeWidth={1.6} aria-hidden />
          </div>
        )
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-base font-semibold">{p.titre}</span>
          {p.masque_par_equipe ? <Badge tone="warn">Masqué par l&apos;équipe</Badge> : <Badge>{STATUTS[p.statut] ?? p.statut}</Badge>}
        </div>
        <span className="text-sm text-ink-soft">
          {[p.shop_name, p.categorie, p.prix != null ? `${Number(p.prix).toLocaleString("fr-FR")} GNF` : null].filter(Boolean).join(" · ")}
        </span>
        <span className="text-2xs text-ink-soft">Publié le {jourEtHeure(p.created_at)}</span>
      </div>
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
      <GesteSuppression
        libelle="Supprimer ce produit"
        action={supprimerProduitEquipeAction}
        champ="produit"
        valeur={p.product_id}
        retour={retour}
        avertissement="Le produit et ses photos sont effacés. Les conversations qui le citaient restent. Impossible à annuler."
        bouton="Supprimer définitivement"
      />
    </Card>
  );
}

/* ---------- Équipe ---------- */

export function EquipeVue({ membres, ...m }: { membres: Membre[] } & Messages) {
  const retour = "/admin/gestion/equipe";
  /* L'écran suit la base (0067) : seul le propriétaire ajoute ou retire. */
  const proprietaire = membres.some((u) => u.moi && u.proprietaire);
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
                  {u.proprietaire ? <Badge tone="accent">Propriétaire</Badge> : null}
                  {u.moi ? <Badge>Vous</Badge> : null}
                </div>
                <span className="text-sm text-ink-soft">{u.email ?? "Adresse inconnue"}</span>
                <span className="text-2xs text-ink-soft">Membre depuis le {jourEtHeure(u.created_at)}</span>
                {u.moi || u.proprietaire || !proprietaire ? null : (
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

          {proprietaire ? (
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
          ) : (
            <p className="text-sm text-ink-soft">Seul le propriétaire de Filloo ajoute ou retire un membre de l&apos;équipe.</p>
          )}
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
            /* Seulement les catégories de la mode : les anciennes (0074)
               restent en base, masquées, et ne se gèrent plus d'ici. */
            elements={categories.filter((c) => c.visible).map((c) => ({ id: c.id, nom: c.name, position: c.position }))}
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
      <p className="text-sm text-ink-soft">{note} L&apos;ordre : le plus petit nombre en premier ; il se refait seul après un retrait.</p>
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
