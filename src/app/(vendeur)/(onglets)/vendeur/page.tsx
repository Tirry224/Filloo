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
 * Accueil commerçant — l'écran d'ouverture de l'espace.
 *
 * CE QU'IL ÉTAIT, ET POURQUOI IL A CHANGÉ
 * `/vendeur` portait à la fois les chiffres d'activité et la liste
 * complète des produits. Les deux s'y gênaient : les cartes repoussaient
 * le catalogue vers le bas, et un catalogue un peu long noyait les
 * chiffres. Le prototype (`design/`) séparait déjà ces deux gestes en
 * deux onglets — regarder où l'on en est, et tenir son stock. La liste
 * vit maintenant sur `/vendeur/produits` ; cet écran ne garde que la
 * lecture.
 *
 * LES TROIS CHIFFRES, ET CELUI QUI N'Y EST PAS
 * Le prototype en affiche trois : produits actifs, messages non lus,
 * « vues boutique ». Les deux premiers sont calculés depuis la vraie
 * base. Le troisième NE L'EST PAS, parce qu'aucune table de ce projet ne
 * compte les vues d'une boutique — ni `merchants`, ni `products`. On ne
 * l'affiche donc pas : un tableau de bord dont un chiffre sur trois est
 * inventé n'est pas un tableau de bord, c'est une image. L'ajouter
 * demanderait une colonne, une migration et une décision sur ce qu'on
 * compte (une visite ? un visiteur ? sur quelle durée ?) — un autre
 * travail, à décider, pas à improviser ici.
 *
 * À sa place, une donnée que la base tient DÉJÀ : `products.contact_count`
 * compte les clients DISTINCTS ayant posé une question sur un produit
 * (voir `bump_contact_count`, 0002 partie 3.3). Leur somme dit combien de
 * personnes se sont manifestées — ce que « vues » prétendait approcher,
 * mesuré pour de bon.
 */
export default async function MerchantHomePage({
  searchParams,
}: {
  /* `erreur` est posé par les actions de `src/lib/actions/products.ts`
     quand l'une d'elles échoue : elles redirigent ici plutôt que de se
     taire. Voir `Notice` pour pourquoi le message passe par l'URL. */
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createClient();
  /* La suspension et le rôle sont traités par `(vendeur)/layout.tsx` pour
     TOUT l'espace, via `requireMerchantSpace`. Ne reste ici que ce que ce
     layout laisse volontairement passer : un profil commerçant sans
     boutique, et une boutique dont le statut décide de l'écran. */
  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");

  /* Le message d'erreur SUIT la redirection. Sans ces deux lignes, il
     mourait ici : une action produit qui échoue revient toujours sur
     `/vendeur?erreur=…` (voir `backToSeller`), et `/vendeur` renvoyait
     aussitôt une boutique non validée vers son écran de statut — en
     laissant le paramètre derrière lui. Le refus de la base était donc
     correct, expliqué, et invisible. */
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
  /* Trois suffisent : cet écran donne un aperçu, la liste complète est à
     un onglet d'ici. Au-delà, on recopierait `/vendeur/messages`. */
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

      <ScreenBody>
        {erreur ? <Notice>{erreur}</Notice> : null}

        <Section className="gap-5">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-xl font-bold">Bonjour, {merchant.shopName}</h1>
            <p className="text-sm text-ink-soft">Voici où en est votre boutique aujourd&apos;hui.</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Votre activité</SectionLabel>
            {/* Trois colonnes égales, comme le prototype. Les deux cartes
                qui MÈNENT quelque part sont des liens ; celle qui ne fait
                que compter n'en est pas un — un bloc cliquable qui ne
                réagit pas apprend à ne plus rien toucher. */}
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
            /* Une boutique neuve n'a rien à lire dans ses chiffres : trois
               zéros et un écran vide diraient seulement « il ne se passe
               rien », sans dire quoi faire. On garde donc l'appel à
               l'action qui vivait sur l'ancien écran — c'est le seul geste
               utile à ce stade. */
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
                        {/* Deux états, pas trois. Le prototype en montrait
                            un troisième (« À répondre »), qui supposerait
                            de savoir QUI a écrit en dernier — une donnée
                            que `Thread` ne porte pas. On dit ce qu'on sait
                            plutôt que de deviner. */}
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
