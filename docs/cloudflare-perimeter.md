# Cloudflare perimeter — bymy.hu

A kód oldali lépések (CF-Connecting-IP, Turnstile reveal-contact, prod Turnstile kötelező) már a repóban vannak.  
Ez a dokumentum a **Cloudflare Dashboard + S1 nginx** beállításait írja le.

## Vercel vs bymy.hu — mit kell Cloudflare-en?

| | `bymy.vercel.app` | `bymy.hu` (S1 éles) |
|--|-------------------|---------------------|
| **DNS narancs felhő (proxy)** | **Nem kell** — a domain a Vercel infrán fut (`server: Vercel`) | **Kell** — VPS elé WAF/DDoS (`server: cloudflare`, `cf-ray`) |
| **Turnstile widget** | Igen — hostname a widget listában | Igen — ugyanaz a site key env-ben |
| **Bot Fight / WAF / edge rate limit** | Vercel edge (külön) | Cloudflare dashboard |
| **CF-Connecting-IP** | Nincs — Vercel saját `x-forwarded-for` / `x-real-ip` | Van — `clientIp()` ezt olvassa |

**Fontos:** a `bymy.vercel.app` **nem** megy át Cloudflare DNS proxy-n; ettől függetlenül a Turnstile (Cloudflare *termék*) működik, mert a böngésző közvetlenül a `challenges.cloudflare.com`-ot hívja.

## 1) DNS — proxied (narancs felhő) — csak bymy.hu

Cloudflare → **DNS** → `bymy.hu` / `www`:

| Rekord | Proxy |
|--------|-------|
| `bymy.hu` A/AAAA → S1 VPS | **Proxied** (🟠) |
| `www` → `bymy.hu` vagy A | **Proxied** |

Ne legyen szürke felhő (DNS only) éles web/API-n — különben nincs WAF, nincs CF-Connecting-IP, a VPS IP közvetlenül látszik.

**Ellenőrzés (2026-03):** `dig bymy.hu` → Cloudflare IP-k (`104.21.x`, `172.67.x`); `curl -I https://bymy.hu` → `server: cloudflare`.

## 2) SSL/TLS

Cloudflare → **SSL/TLS**:

- Mode: **Full (strict)**
- Origin: Let's Encrypt vagy Cloudflare Origin Certificate az S1 nginx-en
- Always Use HTTPS: be

## 3) Turnstile widget

Cloudflare → **Turnstile** → Add site:

- Hostnames: `bymy.hu`, `www.bymy.hu`, `bymy.vercel.app`
- Widget mode: **Managed**
- Kulcsok → env:
  - Vercel Production: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
  - S1 `.env` / pm2 env: ugyanezek

**Prod viselkedés:** ha `NODE_ENV=production` vagy Vercel, Turnstile **kötelező** — auth és telefon reveal nélkül nem megy.

Ellenőrzés: `GET /api/health` → `turnstile.ok: true`.

## 4) Bot Fight + WAF

Cloudflare → **Security**:

1. **Bot Fight Mode** — be (Free tier is ad védelmet)
2. **WAF** → Managed rules — Cloudflare Managed + OWASP (ahol elérhető)
3. **Security Level** — Medium

### Ajánlott custom rule-ok (WAF)

| Név | Feltétel | Akció |
|-----|----------|--------|
| Auth brute force | URI Path contains `/api/auth/login` AND Bot Score &lt; 30 | Managed Challenge |
| Reveal contact | URI Path contains `/reveal-contact` | Managed Challenge vagy Rate Limit |
| Üres UA API | URI Path starts with `/api/` AND User Agent is empty | Block |

## 5) Rate limiting (edge)

Cloudflare → **Security** → **WAF** → **Rate limiting rules** (plan függő):

| Path | Limit (indulás) |
|------|-----------------|
| `*/api/listings/*/reveal-contact` | 10 / perc / IP |
| `*/api/auth/login` | 5 / perc / IP |
| `*/api/level1/login` | 5 / perc / IP |
| `*/api/listings` (GET lista) | 60 / perc / IP |

Az app szintű limit (`lib/rate-limit.mjs`) maradjon — edge + origin együtt erősebb.

## 6) Cache

Cloudflare → **Caching** → **Cache Rules**:

| URL | Akció |
|-----|--------|
| `/api/*` | Bypass cache |
| `/css/*`, `/js/*`, `/images/*` | Cache (respect query string cache bust) |
| `/cdn-cgi/*` | Bypass (Turnstile) |

## 7) S1 nginx — valódi IP Cloudflare mögül

A Node `clientIp()` a `CF-Connecting-IP` headert olvassa. Az nginx-nek továbbítania kell:

```nginx
location / {
    proxy_pass http://127.0.0.1:3456;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
}
```

**real_ip** (csak Cloudflare IP-kről bízz meg X-Forwarded-For-ban):

```bash
./scripts/update-cloudflare-nginx-ips.sh
# → deploy/nginx-cloudflare-realip.conf
```

Másold S1-re pl. `/etc/nginx/cloudflare-realip.conf`, majd az `http { }` blokkban:

```nginx
include /etc/nginx/cloudflare-realip.conf;
```

Frissítés: havonta vagy Cloudflare IP changelog után futtasd újra a scriptet.

## 8) Ellenőrző lista (éles)

- [ ] `bymy.hu` DNS proxied
- [ ] SSL Full (strict)
- [ ] Turnstile env Vercel + S1
- [ ] `/api/health` → `turnstile.ok: true`
- [ ] Belépés: pipás Turnstile megjelenik
- [ ] Hirdetés: „Telefonszám mutatása” → invisible challenge → szám
- [ ] Bot Fight be
- [ ] Rate limit rule reveal-contact + login
- [ ] nginx `CF-Connecting-IP` + real_ip include

## 9) Mit nem csinál a Cloudflare

- Nyilvános API adatszűrés — app kód (`lib/listing-api-access.mjs`)
- Supabase RLS — S2
- Admin OTP — Level1

A perimeter **kiegészíti**, nem helyettesíti az alkalmazásréteg védelmét.
