#!/usr/bin/env bash
# Cloudflare IP tartományok → nginx real_ip blokk (S1 nginx-hez).
# Futtatás: ./scripts/update-cloudflare-nginx-ips.sh > deploy/nginx-cloudflare-realip.conf
set -euo pipefail

OUT="${1:-deploy/nginx-cloudflare-realip.conf}"
TMP="$(mktemp)"

{
  echo "# Generálva: $(date -u +"%Y-%m-%dT%H:%M:%SZ") — scripts/update-cloudflare-nginx-ips.sh"
  echo "# Cloudflare: https://www.cloudflare.com/ips/"
  echo "# nginx http blokkban: include /etc/nginx/cloudflare-realip.conf;"
  echo ""
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
  echo ""

  for url in "https://www.cloudflare.com/ips-v4" "https://www.cloudflare.com/ips-v6"; do
    curl -fsSL "$url" | while read -r cidr; do
      [ -n "$cidr" ] && echo "set_real_ip_from ${cidr};"
    done
  done
} > "$TMP"

mv "$TMP" "$OUT"
echo "Wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines)" >&2
