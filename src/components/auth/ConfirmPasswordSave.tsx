import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

/**
 * « Enregistrer » qui demande d'abord le mot de passe, dans un panneau.
 *
 * LE CHAMP N'EST PLUS EN BAS DU FORMULAIRE : dernier d'une liste de six,
 * on le remplissait avant même d'avoir décidé d'enregistrer, et le bouton
 * de la barre du haut restait à portée de pouce quand le champ qu'il
 * exige était hors de vue — le refus « confirmez avec votre mot de
 * passe » arrivait sans qu'on voie de quoi il parlait.
 *
 * UN SEUL CHEMIN VERS L'ENREGISTREMENT : le bouton de la barre du haut
 * n'enregistre plus, il OUVRE. Deux boutons « Enregistrer » laisseraient
 * croire que le premier a déjà tout fait.
 *
 * L'attribut `form` relie le champ au formulaire sans en être le parent,
 * ce qui évite de dupliquer celui-ci. C'est un `<details>`, donc sans
 * JavaScript ; `data-panneau` le fait refermer par `ClosePanels` au tap
 * extérieur, confort jamais condition.
 */
export function ConfirmPasswordSave({
  formId,
  title = "Confirmer l'enregistrement",
  hint,
}: {
  /** L'identifiant du `<form>` que ce panneau envoie. */
  formId: string;
  title?: string;
  hint?: string;
}) {
  return (
    <details data-panneau>
      <summary className="cursor-pointer list-none text-base font-semibold text-accent [&::-webkit-details-marker]:hidden">
        Enregistrer
      </summary>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[85vh] w-full max-w-app flex-col rounded-t-2xl border-t border-line bg-surface shadow-sheet">
        <p className="shrink-0 px-4.5 pt-3.5 text-base font-bold">{title}</p>
        <div className="flex flex-col gap-4 overflow-y-auto px-4.5 pt-3 pb-5">
          <Field
            label="Mot de passe actuel"
            htmlFor={`${formId}-currentPassword`}
            hint={hint ?? "Il confirme que c'est bien vous. Il n'est pas modifié ici."}
          >
            <Input
              id={`${formId}-currentPassword`}
              name="currentPassword"
              form={formId}
              type="password"
              autoComplete="current-password"
              placeholder="Votre mot de passe"
            />
          </Field>

          <Button type="submit" form={formId}>
            Enregistrer
          </Button>
        </div>
      </div>
    </details>
  );
}
