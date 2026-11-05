import { CheckCheck, Inbox, MessageCircle, MessageSquareReply } from "lucide-react";
import { AdminTopBar, EnTeteOnglet, Tuile } from "@/components/admin/AdminTopBar";
import { LigneFil } from "@/components/admin/LigneFil";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { FilBoite } from "@/lib/data/equipe";

/** La boîte, affichage seul (données lues par `admin/(onglets)/page.tsx`). */
export function BoiteVue({ nom, fils }: { nom: string | null; fils: FilBoite[] }) {
  const aRepondre = fils.filter((f) => !f.dernierDeLEquipe);
  const repondus = fils.filter((f) => f.dernierDeLEquipe);
  const nonLus = fils.reduce((total, f) => total + f.nonLus, 0);

  return (
    <TabScreen largeur="rangees">
      <AdminTopBar />
      <ScreenBody>
        <Section className="gap-5">
          <EnTeteOnglet
            titre={nom ? `Bonjour, ${nom}` : "Messages"}
            sousTitre="Ce que les utilisateurs ont écrit à l'équipe Filloo."
          />

          <div className="grid grid-cols-3 gap-2.5">
            <Tuile icone={MessageSquareReply} valeur={aRepondre.length} libelle="à répondre" forte={aRepondre.length > 0} />
            <Tuile icone={MessageCircle} valeur={nonLus} libelle={nonLus > 1 ? "non lus" : "non lu"} />
            <Tuile icone={Inbox} valeur={fils.length} libelle={fils.length > 1 ? "conversations" : "conversation"} />
          </div>

          {fils.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Aucun message pour l'instant"
              description="Quand un utilisateur écrira à l'équipe depuis « Équipe Filloo », son message arrivera ici, avec une notification."
            />
          ) : (
            <>
              {aRepondre.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <SectionLabel>À répondre</SectionLabel>
                  <div className="flex flex-col">
                    {aRepondre.map((f) => (
                      <LigneFil key={f.filDe} fil={f} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg border border-success bg-success-soft px-3.5 py-3 text-sm text-success-ink">
                  <CheckCheck size={18} strokeWidth={2} aria-hidden />
                  Tout le monde a reçu une réponse.
                </div>
              )}

              {repondus.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <SectionLabel>Déjà répondu</SectionLabel>
                  <div className="flex flex-col">
                    {repondus.map((f) => (
                      <LigneFil key={f.filDe} fil={f} />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
