import { redirect } from "next/navigation";
import { FileText, LogOut, MessageCircle, Store, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, MenuList } from "@/components/ui/MenuList";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SwitchSpaceCard } from "@/components/ui/SwitchSpaceCard";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile, getSessionUser } from "@/lib/data/session";
import { getMyMerchant } from "@/lib/data/merchants";
import { signOutAction } from "@/lib/actions/auth";

/**
 * Mon compte — écran 17. « Ma ville » de la maquette a disparu : aucune
 * colonne ne porte la ville d'un CLIENT (les villes de la base
 * n'appartiennent qu'aux boutiques) — retirée plutôt que simulée.
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
               ce qui rendait les comptes liés inatteignables. Constaté dans
               la vraie base le 2026-09-13 : les deux profils du projet sont
               derrière DEUX connexions distinctes, alors que le schéma
               (`unique (auth_user_id, role)`) et `/inscription` savent
               depuis le début en tenir deux sur une seule.

               La mécanique existait, le chemin pour y arriver non : le seul
               lien vers `/inscription` pour un client connecté vivait dans
               l'état vide du fil d'accueil (« Devenir vendeur à X »), et
               disparaît donc dès qu'un produit existe dans sa ville. Une
               fonctionnalité décidée, construite et testée ne sert à rien
               tant qu'aucun écran n'y mène.

               `/inscription` reconnaît déjà une personne connectée : il
               passe en mode « lié », pré-remplit nom et téléphone, et
               n'offre que le rôle manquant. Il n'y avait rien à construire,
               seulement une porte à ouvrir. */
            <MenuList>
              <MenuItem icon={Store} label="Créer mon compte vendeur" href="/inscription" />
            </MenuList>
          )}

          <MenuList>
            {/* `?retour=` porte le chemin de CET écran jusqu'aux conditions,
                qui vivent à la racine et se rejoignent depuis les deux
                espaces. Sans lui, leur flèche retour renverrait tout le
                monde au même endroit — et ferait donc sortir un client
                de son espace pour avoir lu un texte de loi. */}
            <MenuItem
              icon={FileText}
              label="Conditions d'utilisation"
              href="/conditions?retour=/compte"
            />
          </MenuList>

          <MenuList>
            <MenuItem icon={LogOut} label="Se déconnecter" tone="danger" action={signOutAction} />
          </MenuList>
        </Section>
      </ScreenBody>
    </>
  );
}
