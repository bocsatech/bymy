#!/usr/bin/env bash
# Cloudflare IP tartományok → nginx real_ip + geo allowlista (S1).
# Futtatás: ./scripts/update-cloudflare-nginx-ips.sh
#
# Fontos: ne használj allow/deny-t real_ip mellett — a $remote_addr
# a kliens IP lesz, és mindenkit kitilt. A geo $realip_remote_addr
# az eredeti (Cloudflare edge) címet nézi.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REALIP_OUT="${1:-$ROOT/deploy/nginx-cloudflare-realip.conf}"
GEO_OUT="${2:-$ROOT/deploy/nginx-cloudflare-geo.conf}"
TMP_V4="$(mktemp)"
TMP_V6="$(mktemp)"
trap 'rm -f "$TMP_V4" "$TMP_V6"' EXIT

curl -fsSL "https://www.cloudflare.com/ips-v4" >"$TMP_V4"
curl -fsSL "https://www.cloudflare.com/ips-v6" >"$TMP_V6"

{
  echo "# Generálva: $(date -u +"%Y-%m-%dT%H:%M:%SZ") — scripts/update-cloudflare-nginx-ips.sh"
  echo "# Cloudflare: https://www.cloudflare.com/ips/"
  echo "# nginx http { }: include /etc/nginx/cloudflare-realip.conf;"
  echo ""
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
  echo ""
  while read -r cidr; do
    [ -n "$cidr" ] && echo "set_real_ip_from ${cidr};"
  done <"$TMP_V4"
  while read -r cidr; do
    [ -n "$cidr" ] && echo "set_real_ip_from ${cidr};"
  done <"$TMP_V6"
} >"$REALIP_OUT"

{
  echo "# Generálva: $(date -u +"%Y-%m-%dT%H:%M:%SZ") — scripts/update-cloudflare-nginx-ips.sh"
  echo "# http { } blokkban: include /etc/nginx/cloudflare-geo.conf;"
  echo "# server { }-ben: if (\$is_cloudflare_edge = 0) { return 403; }"
  echo "#"
  echo "# \$realip_remote_addr = eredeti peer (CF edge), nem a végkliens."
  echo ""
  echo "geo \$realip_remote_addr \$is_cloudflare_edge {"
  echo "    default 0;"
  echo "    127.0.0.1 1;"
  echo "    ::1 1;"
  while read -r cidr; do
    [ -n "$cidr" ] && echo "    ${cidr} 1;"
  done <"$TMP_V4"
  while read -r cidr; do
    [ -n "$cidr" ] && echo "    ${cidr} 1;"
  done <"$TMP_V6"
  echo "}"
} >"$GEO_OUT"

# Régi allow fájl ne legyen használva
ALLOW_LEGACY="$ROOT/deploy/nginx-cloudflare-allow.conf"
{
  echo "# DEPRECATED — ne include-old. allow/deny + real_ip = 403 minden vendégre."
  echo "# Használd: deploy/nginx-cloudflare-geo.conf + if (\$is_cloudflare_edge = 0)"
  echo "# Generálva: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} >"$ALLOW_LEGACY"

echo "Wrote $REALIP_OUT ($(wc -l <"$REALIP_OUT" | tr -d ' ') lines)" >&2
echo "Wrote $GEO_OUT ($(wc -l <"$GEO_OUT" | tr -d ' ') lines)" >&2
