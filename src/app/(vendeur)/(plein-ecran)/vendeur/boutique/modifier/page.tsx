import { redirect } from "next/navigation";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ShopEditForm } from "@/components/auth/ShopEditForm";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { getCities } from "@/lib/data/reference";
import type { Merchant } from "@/lib/types";
import { shopPhotoUrl } from "@/lib/storage";
import { ConfirmPasswordSave } from "@/components/auth/ConfirmPasswordSave";

type MerchantRow = {
  id: string;
  shop_name: string;
  description: string | null;
  address_hint: string | null;
  whatsapp_phone: string | null;
  photo_path: string | null;
  city_id: number;
  cities: { name: string } | null;
};

export default async function EditShopPage() {
  const supabase = await createClient();

  // Le rôle et la suspension sont traités par `(vendeur)/layout.tsx` ; ne
  // reste ici que le profil commerçant sans boutique.
  const [merchantProfile, cities] = await Promise.all([
    getMyProfile(supabase, "merchant"),
    getCities(supabase),
  ]);
  if (!merchantProfile) redirect("/inscription/boutique");

  const { data: row, error } = await supabase
    .from("merchants")
    .select("id, shop_name, description, address_hint, whatsapp_phone, photo_path, city_id, cities(name)")
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
    photoUrl: row.photo_path ? shopPhotoUrl(row.photo_path) : null,
  };

  return (
    <Screen>
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
          <ShopEditForm merchant={merchant} cityId={row.city_id} photoPath={row.photo_path} cities={cities} />
        </Section>
      </ScreenBody>
    </Screen>
  );
}
