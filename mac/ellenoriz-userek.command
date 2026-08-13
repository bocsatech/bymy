#!/bin/bash
# Autosweb user DB ellenőrzés — mit lát a szerver a gépeden?
set -euo pipefail

DB="$HOME/.autosweb/autosweb.db"
PROFILES="$HOME/.autosweb/profiles.json"
LEGACY="$HOME/Downloads/autosweb/data/autosweb.db"

echo "══════════════════════════════════════"
echo " Autosweb — helyi user adatbázis"
echo "══════════════════════════════════════"
echo ""
echo "Profil JSON: $PROFILES"
if [ -f "$PROFILES" ]; then
  cat "$PROFILES"
else
  echo "  (nincs fájl — még nem mentettél profilt az új kóddal)"
fi
echo ""
echo "SQLite: $DB"
if [ -f "$DB" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 -header -column "$DB" "SELECT id, email, display_name, profile_json, updated_at FROM web_users;"
    echo ""
    sqlite3 -header -column "$DB" "SELECT COUNT(*) AS sessions FROM web_sessions;"
  else
    ls -la "$DB"
    echo "  (sqlite3 nincs telepítve — csak a fájlméret látszik)"
  fi
else
  echo "  (nincs ~/.autosweb/autosweb.db)"
fi
echo ""
if [ -f "$LEGACY" ]; then
  echo "Régi DB is létezik: $LEGACY"
  ls -la "$LEGACY"
fi
echo ""
echo "API ellenőrzés (ha fut a szerver 3456-on):"
curl -sS "http://127.0.0.1:3456/api/auth/db" | head -c 2000 || echo "  szerver nem elérhető"
echo ""
echo ""
read -r -p "ENTER…" _ >/dev/null || true
