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
 * POURQUOI CE DÉCOUPAGE
 * `/vendeur/boutique` présentait ces champs directement modifiables, avec
 * « Enregistrer » en permanence dans la barre du haut. Trois défauts en
 * découlaient, et le premier est le plus coûteux :
 *
 *   - On modifie sans l'avoir décidé. Un doigt qui glisse sur « Ville »
 *     pendant qu'on fait défiler l'écran change la ville de la boutique,
 *     et rien ne le signale tant qu'on n'a pas appuyé sur « Enregistrer ».
 *   - « Enregistrer » restait affiché même quand il n'y avait rien à
 *     enregistrer, donc un bouton qui, la plupart du temps, ne faisait
 *     rien. Un bouton qui ne fait rien apprend à ne plus le regarder.
 *   - Consulter ses informations demandait de lire des champs de saisie,
 *     qui se lisent moins bien qu'un texte : le cadre, le curseur et le
 *     fond blanc disent « écris ici », pas « voici ce que tu as ».
 *
 * La modification devient donc un geste qu'on demande — « Modifier » — et
 * qui s'ouvre sur son propre écran, comme l'ajout d'un produit.
 *
 * PLEIN ÉCRAN, SANS BARRE D'ONGLETS
 * Ce fichier vit dans `(plein-ecran)` comme les formulaires produit : on
 * ne propose pas de partir ailleurs au milieu d'un formulaire à moitié
 * rempli. Les deux sorties sont explicites et mènent au même endroit —
 * la flèche retour (annuler) et « Enregistrer » (voir
 * `updateMerchantAction`), toutes deux vers `/vendeur/boutique`.
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
          `/vendeur/boutique` sans rien écrire. Pas de second bouton
          « Annuler » en bas — il ferait deux chemins pour le même geste,
          et le doigt cherche déjà la flèche en haut à gauche. */}
      <TopBar
        title="Modifier ma boutique"
        backHref="/vendeur/boutique"
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
        </Section>
      </ScreenBody>
    </Screen>
  );
}
