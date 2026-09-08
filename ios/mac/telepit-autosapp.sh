#!/bin/bash
# Ugyanaz, mint a .command — Terminálból is futtatható.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$DIR/Telepit-Downloads-autosapp.command"
