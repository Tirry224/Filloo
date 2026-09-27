/**
 * Branche les hooks Git versionnés dans `.githooks/` : lancé par
 * `npm install` (script `prepare`).
 *
 * Silencieux quand il n'y a pas de dépôt Git — le build Vercel installe
 * les dépendances sans `.git`, et un échec ici casserait le déploiement.
 * En Node plutôt qu'en `git config … || true` : `true` n'existe pas sous
 * le `cmd.exe` que npm utilise sous Windows.
 */
import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
} catch {
  // Pas de dépôt Git : rien à brancher.
}
