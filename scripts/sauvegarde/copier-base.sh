#!/usr/bin/env bash
# Copie la base Supabase dans le dossier donné, selon la procédure de
# Supabase (« Backup and restore using the CLI ») : trois fichiers, rôles,
# schéma, données, plus `comptes.tsv` (comptes.sql) pour la vérification.
#
#   SUPABASE_DB_URL=postgresql://… scripts/sauvegarde/copier-base.sh dossier/
#   scripts/sauvegarde/copier-base.sh dossier/ --local   # pile locale (test)
#
# L'adresse est celle du « Session pooler » (IPv4, port 5432) : l'adresse
# directe de la base n'est joignable qu'en IPv6, ce que GitHub n'a pas.
set -euo pipefail
dossier=${1:?dossier de sortie}
mode=${2:-}
ici=$(cd "$(dirname "$0")" && pwd)
# Version figée : une option renommée (`--db-url` est devenu `--remote` en
# v3) casserait la sauvegarde en silence.
supabase=(npx -y supabase@3.0.0)
mkdir -p "$dossier"

if [ "$mode" = "--local" ]; then
  cible=()
  url=$("${supabase[@]}" status -o env | sed -n 's/^DB_URL="\(.*\)"$/\1/p')
else
  : "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquante}"
  cible=(--remote="$SUPABASE_DB_URL")
  url=$SUPABASE_DB_URL
fi

"${supabase[@]}" db dump ${cible[@]+"${cible[@]}"} -f "$dossier/roles.sql" --role-only
"${supabase[@]}" db dump ${cible[@]+"${cible[@]}"} -f "$dossier/schema.sql"
"${supabase[@]}" db dump ${cible[@]+"${cible[@]}"} -f "$dossier/data.sql" --use-copy --data-only
psql "$url" -v ON_ERROR_STOP=1 -X -q -f "$ici/comptes.sql" > "$dossier/comptes.tsv"

# Une copie vide est une panne, pas une sauvegarde.
for f in roles schema data; do
  [ -s "$dossier/$f.sql" ] || { echo "::error::$f.sql est vide"; exit 1; }
done
grep -q $'^auth.users\t' "$dossier/comptes.tsv" || { echo "::error::comptes.tsv incomplet"; exit 1; }
echo "Copie faite : $(du -sh "$dossier" | cut -f1)"
