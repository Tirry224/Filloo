import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, LogOut, Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { MenuItem, MenuList } from "@/components/ui/MenuList";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { signOutAction } from "@/lib/actions/auth";
import type { Database } from "@/lib/database.types";
import type { Merchant } from "@/lib/types";

type MerchantRow = {
  id: string;
  shop_name: string;
  description: string | null;
  address_hint: string | null;
  whatsapp_phone: string | null;
  status: Database["public"]["Enums"]["merchant_status"];
  rejection_reason: string | null;
  city_id: number;
  cities: { name: string } | null;
};

/**
 * Écran 26 — modifier ma boutique. Accessible quel que soit le statut de
 * la boutique (approuvée, en attente, refusée) : c'est aussi par ici
 * qu'on corrige une boutique refusée avant de la renvoyer.
 *
 * Les trois lectures indépendantes (profil commerçant, profil client,
 * villes) partent EN MÊME TEMPS : rien ici n'a besoin d'attendre le
 * résultat d'un autre. `getMyProfile` est mis en cache par requête (voir
 * `src/lib/data/session.ts`), donc appeler deux fois "merchant" et
 * "client" ne fait qu'UNE requête `profiles` en base, pas deux.
 */
export default async function EditShopPage() {
  const supabase = await createClient();

  /* La liste des villes n'est plus chargée ici : elle ne servait qu'au
     menu déroulant du formulaire, parti sur `/vendeur/boutique/modifier`.
     Une requête de moins sur l'écran qu'on ouvre le plus souvent — et le
     projet se mesure sur un réseau guinéen (docs/PERFORMANCE.md). */
  const [merchantProfile, clientProfile] = await Promise.all([
    getMyProfile(supabase, "merchant"),
    getMyProfile(supabase, "client"),
  ]);
  /* `merchantProfile` ne peut pas être nul ici : `(vendeur)/layout.tsx`
     a déjà refusé l'entrée à une connexion sans profil commerçant, et
     déjà renvoyé un profil suspendu sur `/compte/suspendu`. Les deux
     gardes qui se trouvaient à cette place ont donc disparu, pas été
     oubliées. Le test qui suit ne porte donc PAS sur le profil : il
     porte sur la BOUTIQUE, qu'un profil commerçant tout neuf n'a pas
     encore — c'est le seul cas que le layout laisse volontairement
     passer, et TypeScript a de toute façon besoin de le voir écrit. */
  if (!merchantProfile) redirect("/inscription/boutique");

  const { data: row, error } = await supabase
    .from("merchants")
    .select("id, shop_name, description, address_hint, whatsapp_phone, status, rejection_reason, city_id, cities(name)")
    .eq("profile_id", merchantProfile.id)
    .single<MerchantRow>();
  if (error) throw error;

  const merchant: Merchant = {
    id: row.id,
    shopName: row.shop_name,
    description: row.description,
    city: row.cities?.name ?? "",
    addressHint: row.address_hint,
    whatsappPhone: row.whatsapp_phone,
    status: row.status,
    rejectionReason: row.rejection_reason,
  };

  /* Les cinq informations de la boutique, dans l'ordre du formulaire qui
     les modifie : on retrouve au même rang ce qu'on vient de changer.
     Les champs vides affichent un tiret plutôt que rien — une ligne vide
     laisse croire à un bug d'affichage, un tiret dit « pas renseigné ». */
  const infos = [
    { label: "Nom de la boutique", value: merchant.shopName },
    { label: "Ville", value: merchant.city || "—" },
    { label: "Où vous trouver", value: merchant.addressHint || "—" },
    { label: "Numéro WhatsApp", value: merchant.whatsappPhone || "—" },
    { label: "Description", value: merchant.description || "—" },
  ];

  return (
    <>
      {/* Plus de flèche retour : cet écran est un ONGLET depuis que la
          barre en compte quatre, et un onglet est une destination, pas un
          sous-écran. Une flèche qui renvoie « en arrière » vers un autre
          onglet apprend au doigt un geste faux — on y revient ensuite par
          la barre, et la flèche ne correspond plus à rien. */}
      {/* « Modifier » plutôt qu'« Enregistrer ». Cet écran ne modifiait
          rien la plupart du temps, et affichait pourtant en permanence le
          bouton qui enregistre — un bouton qui, presque toujours, ne fait
          rien. Pire : les champs étaient directement modifiables, donc un
          doigt qui glisse sur « Ville » en faisant défiler changeait la
          ville de la boutique sans que rien ne le dise.

          Modifier est maintenant un geste qu'on DEMANDE, et qui s'ouvre
          sur son propre écran — comme l'ajout d'un produit. */}
      <TopBar
        title="Ma boutique"
        right={
          <Link
            href="/vendeur/boutique/modifier"
            className="flex items-center gap-1 text-base font-semibold text-accent"
          >
            <Pencil size={16} strokeWidth={2.2} aria-hidden />
            Modifier
          </Link>
        }
      />

      <ScreenBody>
        <Section className="gap-5">
          <div className="flex items-center gap-3.5">
            <Avatar name={merchant.shopName} kind="shop" size={64} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-display text-lg font-bold">{merchant.shopName}</span>
              <span className="truncate text-sm text-ink-soft">{merchant.city}</span>
            </div>
          </div>

          {/* Les informations se LISENT ici, elles ne s'y saisissent plus.
              Un champ de saisie se lit moins bien qu'un texte : son cadre,
              son curseur et son fond blanc disent « écris ici », pas
              « voici ce que tu as ». */}
          <div className="flex flex-col gap-2.5">
            <SectionLabel>Informations</SectionLabel>
            {infos.map(({ label, value }) => (
              <Card key={label} className="flex flex-col gap-0.5 p-3.5">
                <span className="text-2xs text-ink-soft">{label}</span>
                {/* `whitespace-pre-line` garde les retours à la ligne d'une
                    description saisie en plusieurs paragraphes — sans lui,
                    tout se recollait en un bloc illisible. */}
                <span className="whitespace-pre-line text-base font-semibold">{value}</span>
              </Card>
            ))}
          </div>

          {/* Le mot de passe a quitté cet écran pour
              `/vendeur/boutique/modifier`, où il est devenu une
              modification du compte comme les autres.

              Il reste joignable par un commerçant SANS compte client lié,
              et c'est ce qui compte : cette page fait office de « mon
              compte » côté commerçant (docs/ECRANS.md, écran 26), et le
              mot de passe appartient à la CONNEXION, pas au profil. Il ne
              vivait longtemps que sur `/compte/informations`, réservé à un
              profil client — un commerçant sans compte lié n'avait alors
              aucun moyen de le changer. Le déplacer d'un écran de cet
              espace à un autre ne rouvre pas ce trou ; l'enlever de
              l'espace, si. */}

          {clientProfile ? (
            <SwitchSpaceCard
              label="Basculer vers mon espace client"
              target={clientProfile.fullName}
              href="/compte"
            />
          ) : (
            /* Le miroir exact de `/compte` : sans compte client, cet
               emplacement était vide, et un commerçant n'avait donc aucun
               chemin pour s'en créer un.

               Ajouté le 2026-09-13 APRÈS avoir ouvert la même porte côté
               client — et seulement parce que le porteur du projet a
               demandé « et la bascule ? ». C'est la deuxième fois que la
               question est posée pour la même raison : une règle qui vaut
               dans les deux sens n'a été traitée que dans un (voir la
               leçon du 2026-09-12 sur les barres d'onglets). Corriger la
               moitié d'une symétrie laisse un défaut qui ressemble à un
               travail fini.

               Un commerçant peut parcourir le catalogue sans compte, mais
               pas ÉCRIRE à un vendeur : sans profil client, il ne peut pas
               acheter sur sa propre place de marché. */
            <MenuList>
              <MenuItem icon={ShoppingBag} label="Créer mon compte client" href="/inscription" />
            </MenuList>
          )}

          <MenuList>
            <MenuItem icon={FileText} label="Conditions d'utilisation" href="/vendeur/conditions" />
          </MenuList>

          {/* La suppression de compte n'était atteignable QUE depuis
              /compte/informations, c'est-à-dire uniquement par quelqu'un
              ayant un profil client. Un commerçant sans compte client ne
              pouvait donc pas supprimer le sien : /compte le renvoyait
              ici. Une fonctionnalité décidée, construite et testée
              (anonymisation + bannissement) restait inaccessible à la
              moitié des comptes — et c'est celle qu'on ne peut pas
              remplacer par un contournement. */}
          <MenuList>
            <MenuItem
              icon={Trash2}
              label="Supprimer mon compte"
              href="/compte/informations/supprimer"
              tone="danger"
            />
            <MenuItem icon={LogOut} label="Se déconnecter" tone="danger" action={signOutAction} />
          </MenuList>
        </Section>
      </ScreenBody>
    </>
  );
}
