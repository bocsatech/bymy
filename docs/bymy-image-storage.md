# Bymy képtár (Cloudflare R2 — ajánlott)

A hirdetésfotók **Cloudflare R2**-ben (`bymy-listings` bucket), publikus URL: **`https://img.bymy.hu/...`**.  
**Supabase Storage** és **S1/S2 lemez** csak fallback / Vercel preview.

Az adatbázis (Postgres) továbbra is tarthatja a metaadatot; a fájl **nem** megy Supabase Storage-ba.

## Env (S1 éles — R2)

```env
BYMY_IMAGE_STORAGE=r2

# Cloudflare dashboard → R2 → Manage R2 API Tokens
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=bymy-listings
R2_PUBLIC_BASE_URL=https://img.bymy.hu
```

| Változó | Jelentés |
|---------|----------|
| `BYMY_IMAGE_STORAGE` | `r2` (éles), `filesystem` (lokál teszt), `supabase` (régi) |
| `R2_ACCOUNT_ID` | Cloudflare fiók ID (Overview oldal) |
| `R2_*` kulcsok | R2 API token (Object Read & Write) |
| `R2_PUBLIC_BASE_URL` | Custom domain: `https://img.bymy.hu` |

Publikus fájl URL minta:  
`https://img.bymy.hu/listing-images/{listingId}/{name}.webp`

## Env (fallback: VPS lemez)

```env
BYMY_IMAGE_STORAGE=filesystem
BYMY_IMAGE_ROOT=/var/www/bymy/data/images
BYMY_IMAGE_PUBLIC_BASE=https://bymy.hu
```

| Változó | Jelentés |
|---------|----------|
| `BYMY_IMAGE_STORAGE` | `filesystem` (ajánlott S1-en) vagy `supabase` (régi / Vercel preview) |
| `BYMY_IMAGE_ROOT` | Abszolút mappa a szerveren (pl. S2 mount: `/mnt/bymy-images`) |
| `BYMY_IMAGE_PUBLIC_BASE` | Nyilvános origin **perjel nélkül** — URL: `{BASE}/media/img/listing-images/…` |

Alapértelmezés: **nem-Vercel** környezetben `filesystem`; Vercelen továbbra is `supabase` storage (ephemeral lemez).

## URL és fájl elrendezés

- Publikus: `https://bymy.hu/media/img/listing-images/{listingId}/{name}.webp`
- Lemez: `{BYMY_IMAGE_ROOT}/listing-images/{listingId}/{name}.webp`

A Node app kiszolgálja a `/media/img/…` útvonalat (`server.mjs`), vagy nginx alias (lásd lent).

## nginx — img.bymy.hu (ajánlott nagy forgalomnál)

```nginx
server {
  listen 443 ssl http2;
  server_name img.bymy.hu;

  root /var/www/bymy/data/images;
  location / {
    # URL: https://img.bymy.hu/listing-images/42/photo.webp
    # Ehhez állítsd: BYMY_IMAGE_PUBLIC_BASE=https://img.bymy.hu
    # és egy rewrite / media prefix igazítás (jelenleg prefix: /media/img a bymy.hu-n).
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

**Megjegyzés:** a jelenlegi kód publikus path-ja `/media/img/{bucket}/…`. `img.bymy.hu`-n vagy nginx rewrite-ot használj (`/media/img` → root), vagy állítsd a publikus base-t és később egyszerűsítsd az URL sémát.

## S2 + S1

- **S2:** nagy NVMe, `BYMY_IMAGE_ROOT` mount (pl. `/var/www/bymy/data/images` rsync vagy NFS).
- **S1:** app + nginx proxy `img.bymy.hu` → S2 belső IP (8080/static), vagy Cloudflare → S2.

## Migráció Supabase Storage-ról

1. Meglévő bucket fájlok letöltése / `scripts/` (későbbi batch).
2. Új feltöltések már filesystem-re mennek.
3. Régi `*.supabase.co` URL-ek a listában továbbra is működnek (közvetlen link).

## Ellenőrzés

```bash
curl -s https://bymy.hu/api/health | jq .
# imageStorage: "filesystem", imageRoot: "…"
```

Feltöltés után a válasz `url` mezője `/media/img/…` vagy teljes `https://…/media/img/…`.
