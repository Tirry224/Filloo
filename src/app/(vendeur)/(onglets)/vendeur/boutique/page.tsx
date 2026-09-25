import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, FileText, LifeBuoy, ShieldCheck, KeyRound, LogOut, Pencil, ShoppingBag, Trash2, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { MenuItem, MenuList, MenuPanel } from "@/components/ui/MenuList";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { PushInvite } from "@/components/push/PushInvite";
import { PushToggle } from "@/components/push/PushToggle";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { signOutAction } from "@/lib/actions/auth";
import type { Database } from "@/lib/database.types";
import type { Merchant } from "@/lib/types";
import { shopPhotoUrl } from "@/lib/storage";

type MerchantRow = {
  id: string;
  shop_name: string;
  description: string | null;
  address_hint: string | null;
  whatsapp_phone: string | null;
  photo_path: string | null;
  status: Database["public"]["Enums"]["merchant_status"];
  rejection_reason: string | null;
  city_id: number;
  cities: { name: string } | null;
};

/**
 * Accessible quel que soit le statut de la boutique — approuvée, en
 * attente, refusée —, car c'est aussi d'ici qu'on repart corriger une
 * boutique refusée.
 */
export default async function EditShopPage() {
  const supabase = await createClient();

  const [merchantProfile, clientProfile] = await Promise.all([
    getMyProfile(supabase, "merchant"),
    getMyProfile(supabase, "client"),
  ]);
  /* Rôle et suspension sont traités par `(vendeur)/layout.tsx`. Ce test
     porte sur la BOUTIQUE, qu'un profil commerçant neuf n'a pas encore :
     le seul cas que le layout laisse passer. */
  if (!merchantProfile) redirect("/inscription/boutique");

  const { data: row, error } = await supabase
    .from("merchants")
    .select("id, shop_name, description, address_hint, whatsapp_phone, photo_path, status, rejection_reason, city_id, cities(name)")
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
    status: row.status,
    rejectionReason: row.rejection_reason,
  };

  const infos = [
    { label: "Nom de la boutique", value: merchant.shopName },
    { label: "Ville", value: merchant.city || "—" },
    { label: "Où vous trouver", value: merchant.addressHint || "—" },
    { label: "Numéro WhatsApp", value: merchant.whatsappPhone || "—" },
    { label: "Description", value: merchant.description || "—" },
  ];

  return (
    <TabScreen largeur="rangees">
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
            <Avatar name={merchant.shopName} kind="shop" size={64} src={merchant.photoUrl} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-display text-lg font-bold">{merchant.shopName}</span>
              <span className="truncate text-sm text-ink-soft">{merchant.city}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Informations</SectionLabel>
            {infos.map(({ label, value }) => (
              <Card key={label} className="flex flex-col gap-0.5 p-3.5">
                <span className="text-2xs text-ink-soft">{label}</span>
                <span className="whitespace-pre-line text-base font-semibold">{value}</span>
              </Card>
            ))}
          </div>

          {clientProfile ? (
            <SwitchSpaceCard
              label="Basculer vers mon espace client"
              target={clientProfile.fullName}
              href="/compte"
            />
          ) : (
            <MenuList>
              <MenuItem icon={ShoppingBag} label="Créer mon compte client" href="/inscription" />
            </MenuList>
          )}

          <PushInvite raison="Un client qui n'obtient pas de réponse écrit à la boutique suivante. C'est le seul canal qui vous prévient sur un écran verrouillé, application fermée." />

          <MenuList>
            <MenuItem icon={User} label="Mes informations" href="/vendeur/informations" />
            <MenuPanel icon={BellRing} label="Notifications" title="Notifications sur cet appareil">
              <PushToggle />
            </MenuPanel>
            <MenuPanel icon={KeyRound} label="Modifier mon mot de passe" title="Modifier mon mot de passe">
              <ChangePasswordForm />
            </MenuPanel>
            <MenuItem icon={FileText} label="Conditions d'utilisation" href="/vendeur/conditions" />
            <MenuItem icon={ShieldCheck} label="Politique de confidentialité" href="/vendeur/confidentialite" />
            <MenuItem icon={LifeBuoy} label="Nous contacter" href="/vendeur/contact" />
          </MenuList>

          <MenuList>
            <MenuItem
              icon={Trash2}
              label="Supprimer mon compte"
              href="/compte/informations/supprimer?depuis=vendeur"
              tone="danger"
            />
            <MenuItem icon={LogOut} label="Se déconnecter" tone="danger" action={signOutAction} />
          </MenuList>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
