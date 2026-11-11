import { redirect } from "next/navigation";
import { Ban, FileText, LifeBuoy, Megaphone, ShieldCheck, KeyRound, LogOut, Store, Trash2, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, MenuList, MenuPanel } from "@/components/ui/MenuList";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile, getSessionUser } from "@/lib/data/session";
import { getMyMerchant } from "@/lib/data/merchants";
import { compterNonLusEquipe } from "@/lib/data/equipe";
import { signOutAction } from "@/lib/actions/auth";
import { aUnMotDePasse } from "@/lib/password";

export default async function AccountPage() {
  const supabase = await createClient();
  const [profile, user] = await Promise.all([getMyProfile(supabase, "client"), getSessionUser(supabase)]);
  if (!profile) redirect(await clientSpaceFallback(supabase));
  if (profile.isSuspended) redirect("/compte/suspendu");

  const [merchant, nonLusEquipe] = await Promise.all([
    getMyMerchant(supabase),
    user ? compterNonLusEquipe(supabase, user.id, "client") : 0,
  ]);

  return (
    <TabScreen largeur="rangees">
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
            <MenuItem icon={Ban} label="Personnes bloquées" href="/compte/bloques" />
            <MenuItem
              icon={Megaphone}
              label="Équipe Filloo"
              value={nonLusEquipe > 0 ? `${nonLusEquipe} non lu(s)` : undefined}
              href="/compte/equipe"
            />
          </MenuList>

          {merchant ? (
            <SwitchSpaceCard
              label="Basculer vers mon espace commerçant"
              target={merchant.shopName}
              href="/vendeur"
            />
          ) : (
            <MenuList>
              <MenuItem icon={Store} label="Créer mon compte vendeur" href="/inscription" />
            </MenuList>
          )}

          <MenuList>
            {merchant ? null : aUnMotDePasse(user) ? (
              <MenuPanel icon={KeyRound} label="Modifier mon mot de passe" title="Modifier mon mot de passe">
                <ChangePasswordForm />
              </MenuPanel>
            ) : (
              <MenuItem icon={KeyRound} label="Vous vous connectez avec Google" />
            )}
            <MenuItem icon={FileText} label="Conditions d'utilisation" href="/conditions" />
            <MenuItem icon={ShieldCheck} label="Politique de confidentialité" href="/confidentialite" />
            <MenuItem icon={LifeBuoy} label="Nous contacter" href="/contact" />
          </MenuList>

          <MenuList>
            <MenuItem icon={Trash2} label="Supprimer mon compte client" href="/compte/informations/supprimer" tone="danger" />
            <MenuItem icon={LogOut} label="Se déconnecter" tone="danger" action={signOutAction} />
          </MenuList>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
