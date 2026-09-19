import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

/**
 * « Enregistrer » qui demande d'abord le mot de passe, dans un panneau.
 *
 * POURQUOI LE CHAMP N'EST PLUS EN BAS DU FORMULAIRE
 * Il y était, dernier d'une liste de six. Deux défauts s'y ajoutaient :
 * on le remplissait AVANT d'avoir décidé d'enregistrer — donc souvent
 * pour rien — et, sur un écran qui défile, le bouton « Enregistrer » de
 * la barre du haut restait à portée de pouce alors que le champ qu'il
 * exige était deux écrans plus bas, hors de vue. Un refus « confirmez
 * avec votre mot de passe » arrivait alors sans qu'on voie de quoi il
 * parlait.
 *
 * Le demander AU MOMENT du geste supprime les deux : on ne le tape que si
 * l'on enregistre, et il est sous les yeux quand il est exigé.
 *
 * UN SEUL CHEMIN VERS L'ENREGISTREMENT
 * Le bouton de la barre du haut n'enregistre plus : il OUVRE. Le seul
 * bouton qui envoie le formulaire est celui du panneau, sous le champ.
 * Deux boutons portant « Enregistrer » laisseraient croire que le premier
 * a déjà tout fait.
 *
 * COMMENT LE CHAMP REJOINT UN FORMULAIRE QU'IL N'HABITE PAS
 * Le panneau vit dans la barre du haut, le formulaire dans le corps de
 * l'écran : impossible d'imbriquer l'un dans l'autre. L'attribut `form`
 * du HTML relie les deux — un champ peut appartenir à un formulaire qui
 * n'est pas son parent, pourvu qu'il en porte l'identifiant. C'est natif
 * et ancien, et ça évite de dupliquer le formulaire ou de passer par du
 * JavaScript.
 *
 * SANS JAVASCRIPT, ÇA MARCHE AUSSI
 * C'est un `<details>`, comme les panneaux de filtre. `data-panneau` le
 * fait refermer par `ClosePanels` quand on touche à côté — un confort,
 * jamais une condition.
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
