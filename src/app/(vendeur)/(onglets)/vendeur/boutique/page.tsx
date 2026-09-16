import { redirect } from "next/navigation";
import { FileText, LogOut, ShoppingBag, Trash2 } from "lucide-react";
import { MenuItem, MenuList } from "@/components/ui/MenuList";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar } from "@/components/ui/TopBar";
import { ShopEditForm } from "@/components/auth/ShopEditForm";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { getCities } from "@/lib/data/reference";
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

  const [merchantProfile, clientProfile, cities] = await Promise.all([
    getMyProfile(supabase, "merchant"),
    getMyProfile(supabase, "client"),
    getCities(supabase),
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

  return (
    <>
      {/* Plus de flèche retour : cet écran est un ONGLET depuis que la
          barre en compte quatre, et un onglet est une destination, pas un
          sous-écran. Une flèche qui renvoie « en arrière » vers un autre
          onglet apprend au doigt un geste faux — on y revient ensuite par
          la barre, et la flèche ne correspond plus à rien. */}
      <TopBar
        title="Ma boutique"
        right={
          <button
            type="submit"
            form="shop-edit-form"
            className="cursor-pointer text-base font-semibold text-accent"
          >
            Enregistrer
          </button>
        }
      />

      <ScreenBody>
        <Section className="gap-5">
          <ShopEditForm merchant={merchant} cityId={row.city_id} cities={cities} />

          {/* Le mot de passe appartient à la CONNEXION (`auth.users`), pas
              au profil : une personne qui a ses deux comptes liés n'en a
              qu'un seul, et c'est bien le même formulaire des deux côtés.

              Il ne vivait pourtant que sur `/compte/informations`, écran
              réservé à un profil CLIENT — un commerçant sans compte client
              lié était donc renvoyé ici par `clientSpaceFallback` et
              n'avait plus aucun moyen de changer son mot de passe. Le
              troisième trou de la même symétrie, après la bascule et la
              suppression de compte : cet écran fait office de « compte »
              côté commerçant (docs/ECRANS.md, écran 26), il doit porter ce
              que « mon compte » porte. */}
          <div className="my-1 h-px bg-line" />
          <UpdatePasswordForm />

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
            <MenuItem icon={FileText} label="Conditions d'utilisation" value="Bientôt" />
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
