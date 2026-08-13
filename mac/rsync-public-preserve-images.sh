#!/bin/bash
# public/ szinkron — a images/categories/ lokális fájljai NEM íródnak felül (--delete ellenére sem).
# Használat: rsync-public-preserve-images.sh <forrás/autosweb> <cél/autosweb> [--no-delete]
set -euo pipefail

SOURCE="${1:?forrás autosweb mappa}"
TARGET="${2:?cél autosweb mappa}"
DELETE_FLAG=(--delete)
if [ "${3:-}" = "--no-delete" ]; then
  DELETE_FLAG=()
fi

mkdir -p "$TARGET/public/images/categories"
BACKUP=$(mktemp -d)
cp -a "$TARGET/public/images/categories/." "$BACKUP/" 2>/dev/null || true

rsync -a "${DELETE_FLAG[@]}" --exclude 'images/categories/' --exclude 'uploads/' "$SOURCE/public/" "$TARGET/public/"

mkdir -p "$TARGET/public/images/categories"
cp -a "$BACKUP/." "$TARGET/public/images/categories/"
if [ -d "$SOURCE/public/images/categories" ]; then
  for f in "$SOURCE/public/images/categories/"*; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    if [ ! -f "$TARGET/public/images/categories/$base" ]; then
      cp "$f" "$TARGET/public/images/categories/$base"
    fi
  done
fi
rm -rf "$BACKUP"
