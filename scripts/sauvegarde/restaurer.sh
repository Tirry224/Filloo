#!/usr/bin/env bash
# Restaure une copie (copier-base.sh) dans une base Supabase VIDE, puis
# vérifie que chaque table a exactement le même nombre de lignes.
#
#   scripts/sauvegarde/restaurer.sh dossier/ postgresql://…cible
#
# JAMAIS vers la production : la cible doit être un projet neuf (vraie
# restauration) ou une pile locale (test de chaque nuit). Le script refuse
# une cible qui contient déjà des profils.
#
# Procédure de Supabase : rôles, schéma puis données dans UNE transaction,
# avec `session_replication_role = replica` pour que les triggers ne
# rejouent rien (sinon `handle_new_user` recréerait des profils, les
# quotas de messages refuseraient l'historique…).
set -euo pipefail
dossier=${1:?dossier de la copie}
cible=${2:?adresse de la base cible}
ici=$(cd "$(dirname "$0")" && pwd)

deja=$(psql "$cible" -X -tAc "select count(*) from pg_tables where schemaname = 'public' and tablename = 'profiles'")
if [ "$deja" != "0" ]; then
  echo "::error::La cible a déjà un schéma Filloo : restauration refusée (cible non vide)."
  exit 1
fi

psql "$cible" -X -q --single-transaction -v ON_ERROR_STOP=1 \
  --file "$dossier/roles.sql" \
  --file "$dossier/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$dossier/data.sql"

psql "$cible" -v ON_ERROR_STOP=1 -X -q -f "$ici/comptes.sql" > "$dossier/comptes-restaures.tsv"
if diff -u "$dossier/comptes.tsv" "$dossier/comptes-restaures.tsv"; then
  echo "Restauration vérifiée : $(wc -l < "$dossier/comptes.tsv") comptes identiques."
else
  echo "::error::La base restaurée ne compte pas les mêmes lignes que l'original."
  exit 1
fi
