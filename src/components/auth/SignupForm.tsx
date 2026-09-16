"use client";

import { useActionState, useState } from "react";
import { ArrowLeftRight, Package, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { cn } from "@/lib/cn";
import { signUpAction, createLinkedProfileAction, type ActionState } from "@/lib/actions/auth";
import Link from "next/link";

function RoleCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left",
        selected ? "border-accent bg-accent-soft" : "border-line bg-surface",
      )}
    >
      <Icon size={24} strokeWidth={1.7} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-bold">{title}</span>
        <span className="text-xs leading-normal text-ink-soft">{description}</span>
      </div>
      <span
        aria-hidden
        className={cn("mt-0.5 size-5.5 shrink-0 rounded-full border", selected ? "border-6 border-accent" : "border-line")}
      />
    </button>
  );
}

/**
 * Écran 12. Deux modes : `new` (personne pas encore connectée — email et
 * mot de passe demandés, trigger `handle_new_user` côté base) et `linked`
 * (déjà connectée, crée son second compte — pas de mot de passe, c'est la
 * même connexion). `excludeRole` retire le rôle déjà possédé de la liste.
 */
export function SignupForm({
  mode,
  excludeRole,
  defaultFullName,
  defaultPhone,
  next,
}: {
  mode: "new" | "linked";
  excludeRole?: "client" | "merchant";
  defaultFullName?: string;
  defaultPhone?: string;
  /** L'écran à rejoindre une fois le compte créé — voir `safeNextPath`. */
  next?: string;
}) {
  const [role, setRole] = useState<"client" | "merchant">(excludeRole === "client" ? "merchant" : "client");
  const action = mode === "linked" ? createLinkedProfileAction : signUpAction;
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(action, null);

  if (state?.needsConfirmation) {
    return (
      <p className="rounded-lg bg-success-soft px-3.5 py-3 text-sm leading-normal text-success-ink">
        Compte créé. Vérifiez votre email pour confirmer votre adresse avant de vous
        connecter — pensez aux courriers indésirables.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-2.5">
        <SectionLabel>Je viens sur Makiti pour</SectionLabel>
        {excludeRole !== "client" ? (
          <RoleCard
            icon={Search}
            title="Acheter"
            description="Je parcours les produits et je contacte les vendeurs."
            selected={role === "client"}
            onSelect={() => setRole("client")}
          />
        ) : null}
        {excludeRole !== "merchant" ? (
          <RoleCard
            icon={Package}
            title="Vendre"
            description="Je publie mes produits et je reçois les messages des clients."
            selected={role === "merchant"}
            onSelect={() => setRole("merchant")}
          />
        ) : null}
        {mode === "new" ? (
          <p className="flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-xs leading-normal text-accent-hover">
            <ArrowLeftRight size={16} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
            Vous pourrez créer l&apos;autre compte plus tard et basculer entre les deux : ce
            choix n&apos;est pas définitif.
          </p>
        ) : null}
      </div>

      <Field label="Nom complet" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" placeholder="Mariama Diallo" defaultValue={defaultFullName} />
      </Field>

      <Field label="Téléphone" htmlFor="phone" hint="Utilisé uniquement pour vous contacter.">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="620 00 00 00"
          defaultValue={defaultPhone}
        />
      </Field>

      {mode === "new" ? (
        <>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="mariama@exemple.com" />
          </Field>

          <Field label="Mot de passe" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="8 caractères minimum" />
          </Field>

          {/* La double saisie : c'est le seul champ du parcours qu'on ne
              peut pas relire — il s'affiche en points — et celui qui, mal
              tapé, enferme dehors. La personne ne s'en aperçoit qu'à la
              connexion suivante, et la faute coûte alors une
              réinitialisation par email, sur un réseau où recevoir cet
              email n'est pas acquis.

              La comparaison qui COMPTE est celle de `signUpAction`, côté
              serveur : les formulaires de Makiti doivent fonctionner sans
              JavaScript, et une requête forgée ne passe par aucun champ. */}
          <Field label="Confirmer le mot de passe" htmlFor="passwordConfirmation" hint="Retapez-le : c'est le seul champ qu'on ne peut pas relire.">
            <Input
              id="passwordConfirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              placeholder="Le même mot de passe"
            />
          </Field>
        </>
      ) : null}

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : mode === "linked" ? "Créer ce compte" : "Créer mon compte"}
      </Button>

      {mode === "new" ? (
        <p className="text-center text-base text-ink-soft">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-semibold text-accent">
            Se connecter
          </Link>
        </p>
      ) : null}
    </form>
  );
}
