import Link from "next/link";
import { House, MessageCircle, Search, Store, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { messagesHref } from "@/lib/space";

/**
 * Barre d'onglets — DEUX barres, pas une.
 *
 * C'est une décision écrite du projet, pas une préférence
 * (`design/README.md`, `docs/SPEC.md` décision 8) :
 *
 * > Le commerçant et le client n'ont pas la même barre d'onglets, ni le
 * > même écran d'ouverture, ni le même écran « Mon compte ». C'est ce qui
 * > rendait la maquette confuse : les deux rôles y voyaient exactement la
 * > même application.
 *
 * Une seule liste de quatre onglets servait les deux espaces, avec un
 * `accountHref` pour rattraper la différence sur le dernier. Ça ne
 * rattrapait rien : un commerçant voyait « Accueil » et « Rechercher »,
 * deux onglets qui n'existent pas dans son espace et qui l'envoyaient
 * dans le fil du client. Et depuis que `/` renvoie un compte
 * commerçant-seul vers `/vendeur` (voir `landingForSession`), « Accueil »
 * était devenu un onglet MORT : on le touchait, on revenait au même
 * écran. Un onglet qui ne fait rien est pire qu'un onglet absent — on
 * réessaie, on croit que l'application est bloquée.
 *
 * D'où deux listes explicites. Le commerçant en a trois, comme la
 * maquette : « Ma boutique » remplace « Accueil », et « Rechercher »
 * disparaît — chercher des produits est un geste de client. Une personne
 * qui veut les deux crée son compte client lié et bascule ; à tout
 * instant un seul contexte est actif.
 */
const CLIENT_TABS = [
  { key: "home", label: "Accueil", href: "/", icon: House },
  { key: "search", label: "Rechercher", href: "/recherche", icon: Search },
  { key: "messages", label: "Messages", href: messagesHref("client"), icon: MessageCircle },
  { key: "account", label: "Compte", href: "/compte", icon: User },
] as const;

const MERCHANT_TABS = [
  { key: "shop", label: "Ma boutique", href: "/vendeur", icon: Store },
  // `?vue=commercant` n'était produit par AUCUN écran : cet onglet
  // pointait sur `/messages` nu, et `/messages` choisit l'espace client
  // par défaut dès que les deux profils existent. Une personne ayant les
  // deux comptes liés — le scénario même de la décision 8 — touchait donc
  // « Messages » depuis sa boutique et voyait ses conversations
  // D'ACHETEUR. Ses clients lui écrivaient dans le vide, et les deux
  // espaces se mélangeaient, ce que design/README.md interdit.
  { key: "messages", label: "Messages", href: messagesHref("merchant"), icon: MessageCircle },
  { key: "account", label: "Compte", href: "/vendeur/boutique", icon: User },
] as const;

/** `shop` n'existe que côté commerçant, `home`/`search` que côté client :
 * le type les réunit, et passer une clé absente de sa barre ne casse rien
 * — aucun onglet n'est simplement marqué actif. */
export type NavTab = "home" | "search" | "messages" | "account" | "shop";

/**
 * `aria-current="page"` dit à un lecteur d'écran quel onglet est actif.
 * La couleur seule ne le dirait pas — et une information portée
 * uniquement par la couleur est invisible pour une partie des
 * utilisateurs.
 */
export function BottomNav({
  active,
  space = "client",
  unreadCount = 0,
}: {
  active: NavTab;
  /** L'espace ACTIF, jamais le rôle de la personne : quelqu'un qui a les
   * deux comptes liés voit la barre de l'espace où il se trouve. */
  space?: "client" | "merchant";
  /** Messages non lus DANS CET ESPACE (décision 5 de docs/SPEC.md :
   * « badge de non-lus »). Compté par `countUnreadMessages`, passé par
   * l'écran plutôt que lu ici : ce composant sert aussi les squelettes de
   * chargement, qui sont synchrones et ne peuvent rien interroger.
   *
   * Le compteur par FIL existait déjà (`ThreadRow`), mais il fallait être
   * DÉJÀ dans la messagerie pour le voir — c'est-à-dire que rien
   * n'appelait depuis un autre écran. Un commerçant qui range sa boutique
   * n'avait aucun signe qu'un client venait de lui écrire. */
  unreadCount?: number;
}) {
  const tabs = space === "merchant" ? MERCHANT_TABS : CLIENT_TABS;

  return (
    <nav className="sticky bottom-0 flex shrink-0 border-t border-line bg-surface">
      {tabs.map(({ key, label, href, icon: Icon }) => {
        const isActive = key === active;
        const badge = key === "messages" && unreadCount > 0 ? unreadCount : 0;
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            /* Le chiffre du badge est une information : sans ce libellé, un
               lecteur d'écran lirait « Messages 3 » sans dire ce que vaut
               le 3 — ou rien du tout si le badge était masqué. */
            aria-label={badge > 0 ? `${label}, ${badge} non lus` : undefined}
            className={cn(
              "flex h-nav flex-1 flex-col items-center justify-center gap-0.5 text-2xs",
              isActive ? "font-semibold text-accent" : "font-medium text-ink-soft",
            )}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={isActive ? 2 : 1.8} aria-hidden />
              {badge > 0 ? (
                <span aria-hidden className="absolute -top-1 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold text-on-accent">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
