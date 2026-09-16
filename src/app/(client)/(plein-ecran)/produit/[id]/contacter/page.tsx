import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { PriceTag } from "@/components/product/PriceTag";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import { getMyProfile } from "@/lib/data/session";
import { getMyMerchant } from "@/lib/data/merchants";
import { findOrCreateConversation } from "@/lib/actions/messages";

/**
 * Écran 16 — compte requis.
 *
 * Le seul endroit de toute l'application où l'on demande un compte —
 * mais seulement à qui n'en a pas encore. Une connexion déjà cliente
 * n'a rien à créer : elle ouvre directement le fil avec cette boutique
 * (existant ou nouveau), le produit déjà cité pour son premier message.
 */
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  if (!product) notFound();

  const waNumber = product.merchant.whatsappPhone?.replace(/\D/g, "") || null;

  const clientProfile = await getMyProfile(supabase, "client");

  /* On ne se contacte pas soi-même. Une personne qui possède les deux
     comptes liés (décision 8) voit ses propres produits comme n'importe
     quel visiteur : rien ne l'empêchait d'ouvrir un fil avec sa propre
     boutique. Le fil avait alors le même être humain des deux côtés, et
     surtout `bump_contact_count` (0002, 3.3) incrémentait le compteur qui
     sert au tri « populaires » — un vendeur pouvait faire monter ses
     propres produits en s'écrivant à lui-même.

     La base refuse désormais cette insertion (0016), donc le fond est
     tenu ; ici on évite seulement que le refus se présente comme une
     panne. Renvoyer vers l'écran d'actions de SON produit, c'est répondre
     à ce que la personne voulait probablement faire en y arrivant.

     espaces:autorise — le départ vers `/vendeur` est déclenché par la
     personne, sur SON propre produit, et la réponse utile à son geste
     n'existe que dans son espace commerçant. La renvoyer vers l'accueil
     client serait exact et inutile. */
  const myMerchant = await getMyMerchant(supabase);
  if (myMerchant && myMerchant.id === product.merchant.id) {
    redirect(`/vendeur/produits/${product.id}/actions`);
  }

  /* Un client suspendu n'était arrêté nulle part sur ce chemin. Il
     arrivait jusqu'à `findOrCreateConversation`, que le RLS refuse
     (`is_active_profile` dans « conversations: un client contacte un
     commercant ») — et l'exception remontait jusqu'à la frontière
     d'erreur, qui affiche « Vérifiez votre connexion ». Trois causes
     très différentes donnaient donc le même écran : le réseau coupé, le
     quota de conversations atteint, et le compte suspendu.

     La personne suspendue croyait que son téléphone captait mal et
     réessayait indéfiniment, sans jamais voir /compte/suspendu qui
     existe précisément pour le lui dire. */
  if (clientProfile?.isSuspended) redirect("/compte/suspendu");

  /* Un refus de la base n'est pas une panne. Le seul possible ici est le
     quota de 20 nouvelles conversations par jour (décision 13) : il
     remontait jusqu'à la frontière d'erreur, qui affiche « Vérifiez votre
     connexion » — donc la personne croyait son réseau coupé et
     réessayait, indéfiniment, un geste que la base refusera toute la
     journée. C'est le même défaut que celui corrigé pour la suspension
     juste au-dessus, sur le même écran.

     Aucune conversation n'est créée quand la limite est atteinte : le
     trigger s'exécute avant l'insertion (0002, 3.4). */
  const outcome = clientProfile
    ? await findOrCreateConversation(supabase, clientProfile.id, product.merchant.id)
    : null;
  if (outcome?.kind === "ready") {
    redirect(`/messages/${outcome.conversationId}?produit=${product.id}`);
  }

  if (outcome?.kind === "refused") {
    return (
      <Sheet
        title="Vous avez contacté beaucoup de vendeurs aujourd'hui"
        description={outcome.reason}
        closeHref={`/produit/${product.id}`}
      >
        {/* Ce que la personne peut faire MAINTENANT, plutôt qu'un simple
            refus : ses fils déjà ouverts restent accessibles — la limite
            ne porte que sur les NOUVELLES boutiques — et WhatsApp reste
            la porte de sortie habituelle quand la boutique en a donné un. */}
        <Button href="/messages">Voir mes conversations</Button>
        <Button variant="secondary" size="sm" href={`/produit/${product.id}`}>
          Revenir au produit
        </Button>
        {waNumber ? (
          <a
            href={`https://wa.me/${waNumber}`}
            className="text-center text-xs text-ink-soft underline underline-offset-2"
          >
            Ou appelez directement le vendeur sur WhatsApp.
          </a>
        ) : null}
      </Sheet>
    );
  }

  /* L'intention (« écrire au vendeur de CE produit ») voyage avec la
     personne jusqu'à la fin de son inscription ou de sa connexion :
     sinon elle revenait sur le fil d'accueil, le produit perdu, et
     devait le retrouver à la main pour recommencer. Voir
     `safeNextPath`. */
  const next = encodeURIComponent(`/produit/${product.id}/contacter`);

  return (
    <Sheet
      title="Créez un compte pour écrire"
      description="Le vendeur a besoin de savoir qui le contacte. La création du compte prend moins d'une minute, et vous gardez l'accès à vos échanges."
      closeHref={`/produit/${product.id}`}
    >
      <Card className="flex items-center gap-2.5 p-2.5">
        <Photo ratio="free" className="size-11 shrink-0 rounded-md" iconSize={18} />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{product.title}</span>
          <PriceTag amount={product.priceGnf} size="sm" />
        </div>
      </Card>
      <Button href={`/inscription?next=${next}`}>Créer mon compte</Button>
      <Button variant="secondary" size="sm" href={`/connexion?next=${next}`}>
        J&apos;ai déjà un compte
      </Button>
      {/* Cette phrase était un texte NU : ni lien, ni numéro, rien à
          toucher. Sur l'unique écran où l'on demande un compte, elle
          présentait WhatsApp comme l'échappatoire — c'est le chemin le
          plus crédible en Guinée, et c'était un cul-de-sac. Elle ne
          s'affiche plus du tout quand la boutique n'a pas donné de
          numéro : une porte de sortie qu'on annonce sans l'ouvrir est
          pire que pas de porte. */}
      {waNumber ? (
        <a
          href={`https://wa.me/${waNumber}`}
          className="text-center text-xs text-ink-soft underline underline-offset-2"
        >
          Ou appelez directement le vendeur sur WhatsApp.
        </a>
      ) : null}
    </Sheet>
  );
}
