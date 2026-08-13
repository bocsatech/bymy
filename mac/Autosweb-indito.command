#!/bin/bash
# Autosweb indító (Asztal) — induláskor GitHub main-ről frissít, majd elindítja a szervert.
# Nincs szükség külön frissites.command / második terminálra.
#
# Kihagyás (ha offline / gyors újraindítás): AUTOSWEB_SKIP_UPDATE=1
set -euo pipefail

GITHUB_TAR="https://github.com/bocsatech/bocsa-app/archive/refs/heads/main.tar.gz"
DESKTOP_LAUNCHER="$HOME/Desktop/Autosweb-indito.command"

autosweb_target() {
  if [ -d "${HOME}/Downloads/autosweb" ]; then
    echo "${HOME}/Downloads/autosweb"
    return
  fi
  if [ -d "${HOME}/Letöltések/autosweb" ]; then
    echo "${HOME}/Letöltések/autosweb"
    return
  fi
  if [ -d "${HOME}/Letöltések" ]; then
    echo "${HOME}/Letöltések/autosweb"
    return
  fi
  echo "${HOME}/Downloads/autosweb"
}

TARGET="$(autosweb_target)"
INDEX="$TARGET/public/index.html"
HTML="$TARGET/public/hirdetesfeladas.html"
CSS="$TARGET/public/css/site-app.css"

echo "══════════════════════════════════════"
echo " Autosweb"
echo "══════════════════════════════════════"
echo "Cél: $TARGET"
echo ""

# --- Régi szerver leállítása ---
  if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:3456 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Régi szerver leállítása (3456)…"
    # shellcheck disable=SC2086
    kill $PIDS 2>/dev/null || true
    sleep 1
    # shellcheck disable=SC2086
    kill -9 $PIDS 2>/dev/null || true
    sleep 1
  fi
fi

# --- Frissítés GitHub-ról (main) ---
update_from_github() {
  if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
    echo "⚠ curl/tar hiányzik — frissítés kihagyva"
    return 1
  fi

  local tmp src backup
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/autosweb-update.XXXXXX")"

  echo "Frissítés GitHub main-ről…"
  if ! curl -fsSL --connect-timeout 20 --max-time 180 "$GITHUB_TAR" \
    | tar -xz -C "$tmp"; then
    echo "⚠ Letöltés sikertelen — a meglévő helyi fájlokkal indulok."
    rm -rf "$tmp"
    return 1
  fi

  src="$tmp/bocsa-app-main/autosweb"
  if [ ! -d "$src/public" ] || [ ! -f "$src/server.mjs" ]; then
    echo "⚠ Érvénytelen archívum — frissítés kihagyva"
    rm -rf "$tmp"
    return 1
  fi

  mkdir -p "$TARGET/public/images/categories" "$TARGET/data" "$TARGET/lib" "$TARGET/scripts"

  backup="$(mktemp -d "${TMPDIR:-/tmp}/autosweb-cats.XXXXXX")"
  cp -a "$TARGET/public/images/categories/." "$backup/" 2>/dev/null || true

  cp "$src/package.json" "$src/server.mjs" "$TARGET/"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src/lib/" "$TARGET/lib/"
    rsync -a --delete --exclude 'images/categories/' --exclude 'uploads/' "$src/public/" "$TARGET/public/"
    rsync -a "$src/scripts/" "$TARGET/scripts/" 2>/dev/null || true
  else
    rm -rf "$TARGET/lib"
    cp -R "$src/lib" "$TARGET/lib"
    find "$TARGET/public" -mindepth 1 -maxdepth 1 ! -name images -exec rm -rf {} + 2>/dev/null || true
    if [ -d "$TARGET/public/images" ]; then
      find "$TARGET/public/images" -mindepth 1 -maxdepth 1 ! -name categories -exec rm -rf {} + 2>/dev/null || true
    fi
    cp -R "$src/public/"* "$TARGET/public/" 2>/dev/null || true
    rm -rf "$TARGET/scripts"
    cp -R "$src/scripts" "$TARGET/scripts" 2>/dev/null || true
  fi

  mkdir -p "$TARGET/public/images/categories"
  cp -a "$backup/." "$TARGET/public/images/categories/" 2>/dev/null || true
  if [ -d "$src/public/images/categories" ]; then
    for f in "$src/public/images/categories/"*; do
      [ -f "$f" ] || continue
      base="$(basename "$f")"
      if [ ! -f "$TARGET/public/images/categories/$base" ]; then
        cp "$f" "$TARGET/public/images/categories/$base"
      fi
    done
  fi
  rm -rf "$backup"

  # Asztali indító önmagát is frissíti (még a tmp törlése előtt)
  if [ -f "$src/mac/Autosweb-indito.command" ]; then
    mkdir -p "$HOME/Desktop"
    cp "$src/mac/Autosweb-indito.command" "$DESKTOP_LAUNCHER"
    chmod +x "$DESKTOP_LAUNCHER"
    echo "  ✓ Asztali indító frissítve"
  fi
  if [ -f "$src/mac/smtp-beallitas.command" ]; then
    mkdir -p "$HOME/Desktop"
    cp "$src/mac/smtp-beallitas.command" "$HOME/Desktop/Autosweb-smtp-beallitas.command"
    chmod +x "$HOME/Desktop/Autosweb-smtp-beallitas.command"
    echo "  ✓ SMTP beállító az Asztalon: Autosweb-smtp-beallitas.command"
  fi
  if [ -f "$src/mac/oauth-beallitas.command" ]; then
    mkdir -p "$HOME/Desktop"
    cp "$src/mac/oauth-beallitas.command" "$HOME/Desktop/Autosweb-oauth-beallitas.command"
    chmod +x "$HOME/Desktop/Autosweb-oauth-beallitas.command"
    echo "  ✓ OAuth beállító az Asztalon: Autosweb-oauth-beallitas.command"
  fi

  rm -rf "$tmp"
  echo "  ✓ Fájlok frissítve"
  return 0
}

if [ "${AUTOSWEB_SKIP_UPDATE:-0}" = "1" ]; then
  echo "Frissítés kihagyva (AUTOSWEB_SKIP_UPDATE=1)"
else
  update_from_github || true
fi

# --- Telepítés ellenőrzés ---
if [ ! -d "$TARGET" ] || [ ! -f "$TARGET/server.mjs" ]; then
  osascript -e 'display alert "Autosweb" message "Nincs telepítve ~/Downloads/autosweb.\n\nElőször futtasd: bocsa-app/autosweb/mac/telepites.command\nvagy ellenőrizd az internetet (az indító letölti a fájlokat)."' 2>/dev/null || \
    echo "Nincs telepítve: $TARGET — futtasd: telepites.command (vagy indítsd online újra)"
  exit 1
fi

# User DB mappa — mindig létezzen (profil mentés ide ír)
mkdir -p "$HOME/.autosweb"
echo "Autosweb user data: $HOME/.autosweb" > "$HOME/.autosweb/README.txt"

# Kötelező: új user/profil kód (különben a név NEM mentődik)
if [ ! -f "$TARGET/lib/web-user-profiles.mjs" ] || [ ! -f "$TARGET/lib/web-users.mjs" ]; then
  osascript -e 'display alert "Régi Autosweb!" message "Hiányzik a user adatbázis kód (web-user-profiles.mjs).\n\nKell internet, majd indítsd ÚJRA az Autosweb-indito.command-ot — frissít GitHub main-ről."' 2>/dev/null || true
  echo "✗ HIBA: régi Autosweb — nincs lib/web-user-profiles.mjs"
  echo "  Ellenőrizd az internetet, majd indítsd újra (GitHub frissítés)."
  exit 1
fi

if ! grep -q 'profiles.json\|saveProfileToFile\|getProfilesFilePath' "$TARGET/lib/web-user-profiles.mjs" 2>/dev/null; then
  echo "✗ HIBA: web-user-profiles.mjs régi/üres"
  exit 1
fi

if ! grep -q 'api/auth/db\|inspectWebUsersDb\|auth20260805localdb' "$TARGET/public/beallitasok.html" "$TARGET/server.mjs" 2>/dev/null; then
  echo "⚠ Figyelem: beallitasok/server lehet régi — Cmd+Shift+R a böngészőben kötelező"
fi

echo "✓ User DB kód OK (profiles.json támogatás)"
echo "  Profil: $HOME/.autosweb/profiles.json"

if [ -f "$HOME/.autosweb/smtp.json" ]; then
  echo "✓ SMTP config: $HOME/.autosweb/smtp.json"
else
  echo "⚠ SMTP nincs — aktiváló emailhez: autosweb/mac/smtp-beallitas.command"
  echo "  (vagy másold ~/.autosweb/smtp.example.json → smtp.json Gmail app jelszóval)"
fi

cd "$TARGET"

if [ ! -f "$CSS" ]; then
  osascript -e 'display alert "Régi verzió!" message "Hiányzik site-app.css. Indítsd újra az Autosweb-indito.command-ot online."' 2>/dev/null || true
  exit 1
fi

if ! grep -q 'site-app' "$HTML" 2>/dev/null; then
  osascript -e 'display alert "Régi verzió!" message "Régi HTML. Indítsd újra online — az indító letölti a frissítést."' 2>/dev/null || true
  exit 1
fi

if [ ! -f "$INDEX" ]; then
  osascript -e 'display alert "Hiányzik a főoldal!" message "public/index.html nincs."' 2>/dev/null || true
  exit 1
fi

# --- npm + katalógus ---
if [ ! -d node_modules ] || [ ! -d node_modules/nodemailer ]; then
  echo "npm install…"
  npm install
fi

if [ -f "$HOME/Desktop/lista.csv" ]; then
  echo "Járműkatalógus import (~/Desktop/lista.csv)…"
  npm run import:catalog -- "$HOME/Desktop/lista.csv" && echo "  ✓ katalógus OK" || echo "  ⚠ katalógus import sikertelen"
elif [ -f "$HOME/Desktop/lista3.csv" ]; then
  echo "Járműkatalógus import (~/Desktop/lista3.csv)…"
  npm run import:catalog -- "$HOME/Desktop/lista3.csv" && echo "  ✓ katalógus OK" || echo "  ⚠ katalógus import sikertelen"
elif [ -f "$HOME/Downloads/lista.csv" ]; then
  echo "Járműkatalógus import (~/Downloads/lista.csv)…"
  npm run import:catalog -- "$HOME/Downloads/lista.csv" && echo "  ✓ katalógus OK" || true
fi

if [ -f "$TARGET/scripts/embed-ad-form.mjs" ]; then
  node scripts/embed-ad-form.mjs 2>/dev/null || true
fi

INDEX_VER=$(grep 'autosweb-version' "$INDEX" | head -1 | sed 's/.*content="//;s/".*//' || true)
echo ""
echo "Autosweb főoldal: ${INDEX_VER:-?}"
echo "URL: http://127.0.0.1:3456/"
echo "User DB (állandó): $HOME/.autosweb/autosweb.db"
echo "Profil fájl:       $HOME/.autosweb/profiles.json"
echo "Bezáráshoz: Ctrl+C"
echo ""
echo "Ha a profil fájl mentés után sincs: Cmd+Shift+R, majd Fiókom → Adatok mentése"
echo ""

mkdir -p "$HOME/.autosweb"
open "http://127.0.0.1:3456/beallitasok.html?szekcio=fiok" 2>/dev/null || open "http://127.0.0.1:3456/" 2>/dev/null || true
npm start
