import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, MessageCircle, Package, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant, getMerchantProducts } from "@/lib/data/merchants";
import { countUnreadMessages, getMyThreadsAsMerchant } from "@/lib/data/messages";

/**
 * Accueil commerçant — l'écran d'ouverture de l'espace. La liste complète
 * des produits vit sur `/vendeur/produits` : ici, la lecture seulement.
 *
 * Le prototype affiche « vues boutique », qu'aucune table ne compte : un
 * chiffre inventé ferait une image, pas un tableau de bord. À sa place, une
 * donnée que la base tient déjà — la somme des `products.contact_count`,
 * soit les clients DISTINCTS ayant posé une question (`bump_contact_count`,
 * 0002 partie 3.3).
 */
export default async function MerchantHomePage({
  searchParams,
}: {
  // `erreur` est posé par les actions de `src/lib/actions/products.ts` ;
  // voir `Notice` pour pourquoi le message passe par l'URL.
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createClient();
  /* La suspension et le rôle sont traités par `(vendeur)/layout.tsx`. Ne
     reste ici que ce qu'il laisse volontairement passer : un profil sans
     boutique, et une boutique dont le statut décide de l'écran. */
  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");

  // Le message d'erreur SUIT la redirection : sans ça, une boutique non
  // validée part vers son écran de statut en laissant le paramètre ici.
  const suite = erreur ? `?erreur=${encodeURIComponent(erreur)}` : "";
  if (merchant.status === "pending") redirect(`/vendeur/attente${suite}`);
  if (merchant.status === "rejected") redirect(`/vendeur/refusee${suite}`);

  const [catalogue, unreadCount, threads] = await Promise.all([
    getMerchantProducts(supabase, merchant),
    countUnreadMessages(supabase, "merchant"),
    getMyThreadsAsMerchant(supabase),
  ]);

  const published = catalogue.filter((p) => p.status === "active").length;
  const contacts = catalogue.reduce((total, p) => total + p.contactCount, 0);
  // Trois suffisent : au-delà, on recopierait `/vendeur/messages`.
  const dernieres = threads.slice(0, 3);

  return (
    <>
      <TopBar
        title={<Wordmark />}
        right={
          <span className="flex items-center gap-1 text-2xs font-semibold text-success">
            <Check size={13} strokeWidth={2.8} aria-hidden />
            Boutique validée
          </span>
        }
      />

      <ScreenBody rangees>
        {erreur ? <Notice>{erreur}</Notice> : null}

        <Section className="gap-5">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-xl font-bold">Bonjour, {merchant.shopName}</h1>
            <p className="text-sm text-ink-soft">Voici où en est votre boutique aujourd&apos;hui.</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Votre activité</SectionLabel>
            {/* Les deux cartes qui MÈNENT quelque part sont des liens ;
                celle qui ne fait que compter n'en est pas un — un bloc
                cliquable qui ne réagit pas apprend à ne plus rien toucher. */}
            <div className="flex gap-2.5">
              <Link href="/vendeur/produits" className="flex-1">
                <Card className="flex h-full flex-col gap-0.5 p-3">
                  <Package size={18} strokeWidth={1.9} className="text-ink-soft" aria-hidden />
                  <span className="font-display text-2xl font-bold">{published}</span>
                  <span className="text-2xs text-ink-soft">
                    produit{published > 1 ? "s" : ""} actif{published > 1 ? "s" : ""}
                  </span>
                </Card>
              </Link>

              <Link href="/vendeur/messages" className="flex-1">
                <Card className="flex h-full flex-col gap-0.5 border-accent bg-accent-soft p-3">
                  <MessageCircle size={18} strokeWidth={1.9} className="text-accent-hover" aria-hidden />
                  <span className="font-display text-2xl font-bold text-accent-hover">{unreadCount}</span>
                  <span className="text-2xs font-medium text-accent-hover">
                    message{unreadCount > 1 ? "s" : ""} non lu{unreadCount > 1 ? "s" : ""}
                  </span>
                </Card>
              </Link>

              <Card className="flex flex-1 flex-col gap-0.5 p-3">
                <Users size={18} strokeWidth={1.9} className="text-ink-soft" aria-hidden />
                <span className="font-display text-2xl font-bold">{contacts}</span>
                <span className="text-2xs text-ink-soft">
                  client{contacts > 1 ? "s" : ""} intéressé{contacts > 1 ? "s" : ""}
                </span>
              </Card>
            </div>
          </div>

          {catalogue.length === 0 ? (
            // Trois zéros diraient « il ne se passe rien » sans dire quoi
            // faire : l'appel à l'action est le seul geste utile ici.
            <EmptyState
              icon={Plus}
              title="Votre boutique est vide"
              description="Un premier produit avec une photo nette et un prix clair suffit pour recevoir vos premiers messages."
            >
              <Button href="/vendeur/produits/nouveau">Ajouter mon premier produit</Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Dernières demandes</SectionLabel>

              {dernieres.length === 0 ? (
                <Card className="p-3.5">
                  <p className="text-sm text-ink-soft">
                    Aucune demande pour l&apos;instant. Vos clients vous écriront depuis vos produits.
                  </p>
                </Card>
              ) : (
                <>
                  {dernieres.map((thread) => (
                    <Link key={thread.id} href={`/vendeur/messages/${thread.id}`}>
                      <Card className="flex items-center gap-3 p-3.5">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-base font-semibold">{thread.peerName}</span>
                          <span className="truncate text-xs text-ink-soft">{thread.lastProductTitle}</span>
                        </div>
                        {/* Deux états, pas trois : le troisième du prototype
                            (« À répondre ») supposerait de savoir QUI a
                            écrit en dernier, que `Thread` ne porte pas. */}
                        {thread.unreadCount > 0 ? (
                          <Badge tone="accent">Nouveau</Badge>
                        ) : (
                          <Badge tone="neutral">En discussion</Badge>
                        )}
                      </Card>
                    </Link>
                  ))}

                  {threads.length > dernieres.length ? (
                    <Link
                      href="/vendeur/messages"
                      className="py-1 text-center text-sm font-semibold text-accent"
                    >
                      Voir les {threads.length} conversations
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          )}
        </Section>
      </ScreenBody>
    </>
  );
}
