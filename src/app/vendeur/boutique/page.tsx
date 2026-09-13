import { redirect } from "next/navigation";
import { FileText, LogOut, ShoppingBag } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";
import { MenuItem, MenuList } from "@/components/ui/MenuList";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar } from "@/components/ui/TopBar";
import { ShopEditForm } from "@/components/auth/ShopEditForm";
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
    <Screen>
      <TopBar
        title="Ma boutique"
        backHref="/vendeur"
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
            <MenuItem icon={FileText} label="Conditions d'utilisation" />
          </MenuList>

          <MenuList>
            <MenuItem icon={LogOut} label="Se déconnecter" tone="danger" action={signOutAction} />
          </MenuList>
        </Section>
      </ScreenBody>

      <BottomNav active="account" space="merchant" />
    </Screen>
  );
}
