import { redirect } from "next/navigation";
import { BellRing, FileText, KeyRound, LogOut, MessageCircle, Store, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, MenuList, MenuPanel } from "@/components/ui/MenuList";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { PushInvite } from "@/components/push/PushInvite";
import { PushToggle } from "@/components/push/PushToggle";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile, getSessionUser } from "@/lib/data/session";
import { getMyMerchant } from "@/lib/data/merchants";
import { signOutAction } from "@/lib/actions/auth";

/**
 * Mon compte — écran 17. « Ma ville » de la maquette n'est pas ici mais dans
 * « Mes informations », avec le reste de ce qui s'édite (`profiles.city_id`,
 * 0010) ; cet écran ne fait que mener aux réglages.
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const [profile, user] = await Promise.all([getMyProfile(supabase, "client"), getSessionUser(supabase)]);
  if (!profile) redirect(await clientSpaceFallback(supabase));
  if (profile.isSuspended) redirect("/compte/suspendu");

  const merchant = await getMyMerchant(supabase);

  return (
    <>
      <TopBar title="Mon compte" />

      <ScreenBody>
        <Section className="gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={profile.fullName} size={58} />
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold">{profile.fullName}</span>
              <span className="text-sm text-ink-soft">{user?.email}</span>
            </div>
          </div>

          <MenuList>
            <MenuItem icon={User} label="Mes informations" href="/compte/informations" />
            <MenuItem icon={MessageCircle} label="Mes messages" href="/messages" />
          </MenuList>

          {/* Bascule vers le compte commerçant lié : jamais un item de menu
              parmi d'autres, toujours une action à part (voir docs/SPEC.md,
              décision 8). N'apparaît que si ce compte lié existe déjà. */}
          {merchant ? (
            <SwitchSpaceCard
              label="Basculer vers mon espace commerçant"
              target={merchant.shopName}
              href="/vendeur"
            />
          ) : (
            /* Sans compte commerçant, cet emplacement était VIDE, et c'est
               ce qui rendait les comptes liés inatteignables : le schéma
               (`unique (auth_user_id, role)`) et `/inscription` savent
               depuis le début tenir deux rôles sur une seule connexion, mais
               le seul lien vers `/inscription` pour un client connecté vivait
               dans l'état vide du fil d'accueil (« Devenir vendeur à X »),
               qui disparaît dès qu'un produit existe dans sa ville. Une
               fonctionnalité construite ne sert à rien tant qu'aucun écran
               n'y mène — et `/inscription` reconnaît déjà une personne
               connectée (mode « lié », nom et téléphone pré-remplis, seul le
               rôle manquant offert) : rien à construire, une porte à ouvrir. */
            <MenuList>
              <MenuItem icon={Store} label="Créer mon compte vendeur" href="/inscription" />
            </MenuList>
          )}

          {/* Même règle d'emplacement que l'interrupteur en dessous :
              l'abonnement appartient à la CONNEXION, donc avec un compte
              commerçant l'invitation vit sur l'écran boutique et nulle part
              ailleurs — deux invitations laisseraient croire à deux réglages. */}
          {merchant ? null : (
            <PushInvite raison="Un vendeur peut répondre à votre question quelques heures plus tard. C'est le seul canal qui vous prévient sans ouvrir l'application." />
          )}

          <MenuList>
            {/* Le mot de passe ne s'affiche ICI qu'en l'absence de compte
                commerçant ; avec les deux, il vit sur l'écran boutique —
                même connexion, même mot de passe, et l'offrir des deux côtés
                laisserait croire qu'il y en a deux à tenir à jour. */}
            {merchant ? null : (
              <>
                {/* Même règle que le mot de passe : l'abonnement push
                    appartient à la CONNEXION, pas au profil — sinon deux
                    interrupteurs commanderaient le même appareil. */}
                <MenuPanel icon={BellRing} label="Notifications" title="Notifications sur cet appareil">
                  <PushToggle />
                </MenuPanel>
                <MenuPanel icon={KeyRound} label="Modifier mon mot de passe" title="Modifier mon mot de passe">
                  <ChangePasswordForm />
                </MenuPanel>
              </>
            )}
            <MenuItem icon={FileText} label="Conditions d'utilisation" href="/conditions" />
          </MenuList>

          <MenuList>
            <MenuItem icon={LogOut} label="Se déconnecter" tone="danger" action={signOutAction} />
          </MenuList>
        </Section>
      </ScreenBody>
    </>
  );
}
