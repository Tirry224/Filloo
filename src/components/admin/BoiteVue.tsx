import { CheckCheck, Inbox, MessageCircle, MessageSquareReply, SearchX } from "lucide-react";
import { AdminTopBar, EnTeteOnglet, Tuile } from "@/components/admin/AdminTopBar";
import { LigneFil } from "@/components/admin/LigneFil";
import { RechercheListe } from "@/components/admin/RechercheListe";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { FilBoite } from "@/lib/data/equipe";
import { correspond } from "@/lib/recherche";

/** La boîte, affichage seul (données lues par `admin/(onglets)/page.tsx`). */
export function BoiteVue({ nom, fils: tous, recherche }: { nom: string | null; fils: FilBoite[]; recherche: string | null }) {
  /* Les tuiles comptent toute la boîte ; la recherche ne filtre que les listes. */
  const aRepondreTous = tous.filter((f) => !f.dernierDeLEquipe).length;
  const nonLus = tous.reduce((total, f) => total + f.nonLus, 0);
  const fils = recherche ? tous.filter((f) => correspond(recherche, f.nom, f.dernierCorps)) : tous;
  const aRepondre = fils.filter((f) => !f.dernierDeLEquipe);
  const repondus = fils.filter((f) => f.dernierDeLEquipe);

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
            <Tuile icone={MessageSquareReply} valeur={aRepondreTous} libelle="à répondre" forte={aRepondreTous > 0} />
            <Tuile icone={MessageCircle} valeur={nonLus} libelle={nonLus > 1 ? "non lus" : "non lu"} />
            <Tuile icone={Inbox} valeur={tous.length} libelle={tous.length > 1 ? "conversations" : "conversation"} />
          </div>

          {tous.length > 0 ? <RechercheListe action="/admin" valeur={recherche ?? ""} placeholder="Chercher une personne ou un message" /> : null}

          {recherche && fils.length === 0 ? (
            <EmptyState icon={SearchX} title="Aucun résultat" description="Aucune conversation ne correspond à cette recherche." />
          ) : fils.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Aucun message pour l'instant"
              description="Quand un utilisateur écrira à l'équipe depuis « Équipe Filloo », son message arrivera ici, avec une notification."
            />
          ) : (
            <>
              {recherche ? null : aRepondre.length > 0 ? null : (
                <div className="flex items-center gap-2.5 rounded-lg border border-success bg-success-soft px-3.5 py-3 text-sm text-success-ink">
                  <CheckCheck size={18} strokeWidth={2} aria-hidden />
                  Tout le monde a reçu une réponse.
                </div>
              )}
              {aRepondre.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <SectionLabel>À répondre</SectionLabel>
                  <div className="flex flex-col">
                    {aRepondre.map((f) => (
                      <LigneFil key={`${f.filDe}-${f.espace}`} fil={f} />
                    ))}
                  </div>
                </div>
              ) : null}

              {repondus.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <SectionLabel>Déjà répondu</SectionLabel>
                  <div className="flex flex-col">
                    {repondus.map((f) => (
                      <LigneFil key={`${f.filDe}-${f.espace}`} fil={f} />
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
