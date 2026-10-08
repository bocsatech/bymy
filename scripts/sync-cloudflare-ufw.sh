#!/usr/bin/env bash
# S1: UFW 80/443 csak Cloudflare tartományok (OpenSSH változatlan).
# Futtatás rootként a VPS-en: bash scripts/sync-cloudflare-ufw.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Root kell (ufw)." >&2
  exit 1
fi

TMP_V4="$(mktemp)"
TMP_V6="$(mktemp)"
trap 'rm -f "$TMP_V4" "$TMP_V6"' EXIT

curl -fsSL "https://www.cloudflare.com/ips-v4" >"$TMP_V4"
curl -fsSL "https://www.cloudflare.com/ips-v6" >"$TMP_V6"

# Régi Cloudflare címkés szabályok törlése (SSH marad)
while ufw status numbered | grep -q 'Cloudflare'; do
  num="$(ufw status numbered | grep 'Cloudflare' | head -1 | sed -n 's/^\[\s*\([0-9]\+\)\].*/\1/p')"
  [[ -n "$num" ]] || break
  yes | ufw delete "$num" >/dev/null
done

while read -r cidr; do
  [[ -z "$cidr" ]] && continue
  ufw allow from "$cidr" to any port 80 proto tcp comment 'Cloudflare'
  ufw allow from "$cidr" to any port 443 proto tcp comment 'Cloudflare'
done <"$TMP_V4"

while read -r cidr; do
  [[ -z "$cidr" ]] && continue
  ufw allow from "$cidr" to any port 80 proto tcp comment 'Cloudflare'
  ufw allow from "$cidr" to any port 443 proto tcp comment 'Cloudflare'
done <"$TMP_V6"

ufw reload
echo "UFW Cloudflare 80/443 frissítve ($(wc -l <"$TMP_V4" | tr -d ' ') v4 + $(wc -l <"$TMP_V6" | tr -d ' ') v6)."
ufw status | grep -c Cloudflare || true
