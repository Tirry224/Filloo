/** Types de `migrations.mjs`, pour que `tests/migrations.test.ts` passe `npm run typecheck`. */
export function cle(nom: string): string;
export function comparerMigrations(
  fichiers: string[],
  appliquees: { version: string; name: string }[],
): { nonAppliquees: string[]; nonCommitees: string[]; horsOrdre: string[]; total: number };
