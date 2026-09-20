import { redirect } from "next/navigation";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ShopEditForm } from "@/components/auth/ShopEditForm";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { getCities } from "@/lib/data/reference";
import type { Database } from "@/lib/database.types";
import type { Merchant } from "@/lib/types";
import { ConfirmPasswordSave } from "@/components/auth/ConfirmPasswordSave";

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
 * Modifier ma boutique — l'écran d'édition, séparé de sa consultation.
 *
 * Quand `/vendeur/boutique` rendait ces champs modifiables sur place : on
 * modifiait sans l'avoir décidé (un doigt qui glisse sur « Ville » pendant
 * le défilement), « Enregistrer » s'affichait même sans rien à
 * enregistrer, et consulter revenait à lire des champs de saisie, qui
 * disent « écris ici » plutôt que « voici ce que tu as ».
 *
 * Plein écran sans barre d'onglets, comme les formulaires produit : on ne
 * propose pas de partir ailleurs au milieu d'un formulaire à moitié
 * rempli. Les deux sorties mènent à `/vendeur/boutique` — la flèche
 * retour (annuler) et « Enregistrer » (`updateMerchantAction`).
 */
export default async function EditShopPage() {
  const supabase = await createClient();

  /* Le rôle et la suspension sont traités par `(vendeur)/layout.tsx` pour
     tout l'espace. Ne reste ici que le cas que ce layout laisse
     volontairement passer : un profil commerçant sans boutique. */
  const [merchantProfile, cities] = await Promise.all([
    getMyProfile(supabase, "merchant"),
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
      {/* La flèche retour EST le bouton « annuler » : elle ramène sur
          `/vendeur/boutique` sans rien écrire. Pas de second « Annuler »
          en bas — deux chemins pour un même geste. */}
      <TopBar
        title="Modifier ma boutique"
        backHref="/vendeur/boutique"
        right={
          <ConfirmPasswordSave
            formId="shop-edit-form"
            hint="Sans lui, rien n'est enregistré. Il n'est pas modifié ici."
          />
        }
      />

      <ScreenBody>
        <Section className="gap-5">
          <ShopEditForm merchant={merchant} cityId={row.city_id} cities={cities} />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
