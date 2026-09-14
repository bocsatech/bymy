#!/bin/zsh
# Egy Supabase mindenhova: S1 (bymy.hu) + Vercel — forrás: .env.local (S1 éles kulcsok).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "1/2 S1 → helyi .env.local (forrás: bymy.hu éles DB)…"
S1_SSH="${S1_SSH:-bymy-app}" "$ROOT/mac/s1-pull-supabase-env.command" <<< ""

echo ""
echo "2/2 Vercel env + redeploy…"
"$ROOT/mac/vercel-supabase-env.command" <<< ""
