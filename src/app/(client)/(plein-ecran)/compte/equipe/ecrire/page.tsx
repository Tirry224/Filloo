import { redirect } from "next/navigation";

/** Ancienne adresse (notifications déjà reçues, 2026-11-05) : tout vit désormais dans la discussion. */
export default function AncienneAdresse() {
  redirect("/compte/equipe/discussion");
}
