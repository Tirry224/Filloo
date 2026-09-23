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
 * Écran 26 — ma boutique, en LECTURE (la modification vit sur
 * `/vendeur/boutique/modifier`). Accessible quel que soit le statut —
 * approuvée, en attente, refusée —, car c'est aussi d'ici qu'on repart
 * corriger une boutique refusée.
 *
 * Les deux lectures partent EN MÊME TEMPS, aucune n'attendant l'autre.
 * `getMyProfile` est mis en cache par requête (`src/lib/data/session.ts`),
 * donc "merchant" puis "client" ne font qu'UNE requête `profiles`.
 */
export default async function EditShopPage() {
  const supabase = await createClient();

  // Pas de liste de villes ici : elle ne sert qu'au formulaire, parti sur
  // `/vendeur/boutique/modifier`. Une requête de moins (PERFORMANCE.md).
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

  /* Dans l'ordre du formulaire qui les modifie, pour retrouver au même
     rang ce qu'on vient de changer. Un champ vide affiche un tiret : une
     ligne vide laisse croire à un bug. */
  const infos = [
    { label: "Nom de la boutique", value: merchant.shopName },
    { label: "Ville", value: merchant.city || "—" },
    { label: "Où vous trouver", value: merchant.addressHint || "—" },
    { label: "Numéro WhatsApp", value: merchant.whatsappPhone || "—" },
    { label: "Description", value: merchant.description || "—" },
  ];

  return (
    <>
      {/* Plus de flèche retour : cet écran est un ONGLET, donc une
          destination et pas un sous-écran. Une flèche « en arrière » vers
          un autre onglet apprend au doigt un geste faux. */}
      {/* « Modifier » plutôt qu'« Enregistrer » : cet écran affichait en
          permanence le bouton qui enregistre alors qu'il n'y avait presque
          jamais rien à enregistrer, et ses champs modifiables changeaient
          la ville sous un doigt qui fait défiler. Modifier est maintenant
          un geste qu'on DEMANDE, sur son propre écran. */}
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

      <ScreenBody rangees>
        <Section className="gap-5">
          <div className="flex items-center gap-3.5">
            <Avatar name={merchant.shopName} kind="shop" size={64} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-display text-lg font-bold">{merchant.shopName}</span>
              <span className="truncate text-sm text-ink-soft">{merchant.city}</span>
            </div>
          </div>

          {/* Les informations se LISENT ici : un champ de saisie dit
              « écris ici », pas « voici ce que tu as ». */}
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

          {/* Cette page fait office de « mon compte » côté commerçant
              (docs/ECRANS.md, écran 26) : tout ce qui touche à la
              CONNEXION doit y rester joignable par un commerçant SANS
              compte client lié. Le mot de passe ne vivait que sur
              `/compte/informations`, réservé à un profil client — un
              commerçant sans compte lié n'avait aucun moyen de le
              changer. */}

          {clientProfile ? (
            <SwitchSpaceCard
              label="Basculer vers mon espace client"
              target={clientProfile.fullName}
              href="/compte"
            />
          ) : (
            /* Le miroir exact de `/compte` : sans cette carte, un
               commerçant n'a aucun chemin pour se créer un compte client,
               donc peut parcourir le catalogue sans jamais ÉCRIRE à un
               vendeur. */
            <MenuList>
              <MenuItem icon={ShoppingBag} label="Créer mon compte client" href="/inscription" />
            </MenuList>
          )}

          {/* AVANT la liste de réglages, parce que c'est tout le problème
              qu'elle corrige : l'interrupteur était replié dans le panneau
              « Notifications » ci-dessous, et il fallait savoir qu'il y
              était. Elle disparaît une fois l'appareil abonné, ou la
              permission refusée. */}
          <PushInvite raison="Un client qui n'obtient pas de réponse écrit à la boutique suivante. C'est le seul canal qui vous prévient sur un écran verrouillé, application fermée." />

          <MenuList>
            {/* « Mes informations » — le nom et le téléphone de la
                PERSONNE, à ne pas confondre avec « Modifier » en haut, qui
                porte sur la BOUTIQUE. L'écran n'existait que côté client :
                un commerçant sans compte lié ne pouvait pas corriger son
                propre numéro, celui par lequel on l'appelle pour valider
                sa boutique. */}
            <MenuItem icon={User} label="Mes informations" href="/vendeur/informations" />
            {/* Le mot de passe se change ICI et non dans « Modifier ma
                boutique » : les informations de la boutique, un client les
                LIT avant de se déplacer, alors que le mot de passe
                n'appartient qu'à la connexion — le même que celui du
                compte client lié, d'où sa place unique. */}
            {/* Les notifications comptent DOUBLE ici : un commerçant qui
                répond quatre heures après a perdu le client, et c'est le
                seul canal qui arrive sur un écran verrouillé. */}
            <MenuPanel icon={BellRing} label="Notifications" title="Notifications sur cet appareil">
              <PushToggle />
            </MenuPanel>
            <MenuPanel icon={KeyRound} label="Modifier mon mot de passe" title="Modifier mon mot de passe">
              <ChangePasswordForm />
            </MenuPanel>
            <MenuItem icon={FileText} label="Conditions d'utilisation" href="/vendeur/conditions" />
            {/* Mêmes deux lignes que côté client, vers l'espace commerçant :
                les deux espaces ne se mélangent jamais. */}
            <MenuItem icon={ShieldCheck} label="Politique de confidentialité" href="/vendeur/confidentialite" />
            <MenuItem icon={LifeBuoy} label="Nous contacter" href="/vendeur/contact" />
          </MenuList>

          {/* La suppression n'était atteignable que depuis
              `/compte/informations`, donc réservée à qui a un profil
              client : un commerçant sans compte lié ne pouvait pas
              supprimer le sien (anonymisation + bannissement), et rien ne
              remplace cette fonction par un contournement. */}
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
