# Taprivo — Overview & Production Deployment Guide

> Digital loyalty platform: customers collect stamps and redeem rewards at partner
> restaurants/cafés by tapping the merchant's NFC badge or showing a QR code.
> Three apps share one backend: a **Flutter mobile app** (customers + merchant
> scanning), a **React web app** (merchant & admin consoles, PWA), and a
> **Fastify API**.

This document is the single reference for understanding the system and deploying
it for public/production use. It is written against the actual code in this
repository (not a generic template). Where the current setup is
**development-oriented**, the guide calls it out and gives the production change.

---

## 1. What Taprivo is

Taprivo replaces paper punch cards. A customer joins a merchant's loyalty
program, then earns a **stamp** each visit. When the card reaches the merchant's
`stamps_required` threshold, a **reward** (coupon) is issued. The reward is
redeemed at the counter, which resets the card to zero and starts a new cycle.

Two ways to earn/redeem, both validated server-side:

- **NFC (primary)** — the merchant has a provisioned NFC tag (sticker / totem /
  card / bracelet). The customer opens their card in the mobile app and the
  merchant taps the tag on the phone. The app reads the tag's hardware UID and
  calls the backend, which matches the UID to a provisioned device and (when
  coordinates are sent) checks the geofence.
- **QR** — the customer shows a short-lived (60 s) one-time QR; the merchant
  scans it (mobile or web) to award the stamp.

### Roles

| Role | Where | Can do |
|---|---|---|
| `client` | Mobile app (+ web) | Join programs, earn stamps (NFC/QR), view cards, redeem rewards, Google Wallet |
| `merchant` | Web console + mobile owner screens | Configure program, provision NFC tags, scan customer QR, redeem rewards, view stats/customers |
| `admin` | Web console | Full CRUD on users & merchants, global activity & stats, manage all NFC devices |

> `admin` accounts cannot be self-registered; they are seeded or created by an
> existing admin.

---

## 2. Architecture

```
                       ┌─────────────────────────────┐
   Mobile (Flutter)    │            Clients           │   Web (React PWA)
   customers + owner   │                              │   merchant + admin
        │              └─────────────────────────────┘            │
        │ HTTPS (Bearer JWT + X-Device-Id)                        │ HTTPS
        │                                                          │
        ▼                                                          ▼
   ┌────────────────────────────────────────────────────────────────┐
   │  Reverse proxy / TLS  (nginx in the web image, or Caddy/Traefik) │
   │   - serves the web SPA            - proxies /api/* → backend:3000 │
   └────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                     ┌───────────────────────────┐
                     │  Backend  (Fastify, :3000) │
                     │  JWT auth, routes, services │
                     └───────────────────────────┘
                        │                      │
                        ▼                      ▼
              ┌──────────────────┐    ┌──────────────────┐
              │ PostgreSQL 16    │    │ Redis 7          │
              │ + PostGIS        │    │ QR tokens, codes │
              │ (durable data)   │    │ (ephemeral)      │
              └──────────────────┘    └──────────────────┘

   Optional integrations: Google Wallet, Google OAuth, SMTP (email).
```

**Network rule for production:** only the reverse proxy (web/nginx, port 80/443)
should be publicly reachable. Backend `:3000`, Postgres `:5432`, and Redis
`:6379` stay on the internal network.

---

## 3. Tech stack

**Backend** — Node 20, TypeScript (ESM), Fastify 4. PostgreSQL via `pg` (pool
max 10), Redis via `ioredis`. Auth with `@fastify/jwt` + bcrypt. Plugins:
CORS, rate-limit (120 req/min/IP), multipart (logo upload ≤ 2 MB), static
(`/uploads/*`). Validation with Zod. Optional: `google-auth-library`
(Wallet/OAuth), `nodemailer` (SMTP).

**Web** — React 18 + Vite 5 + TypeScript, Tailwind v4, React Router 6, TanStack
Query 5, `motion` animations, `vite-plugin-pwa`. Built to static files served by
nginx 1.27 (which also reverse-proxies `/api`).

**Mobile** — Flutter (Dart ≥ 3.6), Riverpod, go_router, Dio, `nfc_manager`,
`geolocator`, `qr_flutter`/`mobile_scanner`, `flutter_secure_storage`,
`google_sign_in`, `flutter_map`, `lottie`. App id `com.taprivo.taprivo_mobile`,
version `0.1.0+1`.

**Infra** — `docker-compose.yml` with four services: `postgres`
(`postgis/postgis:16-3.4-alpine`), `redis` (`redis:7-alpine`), `backend`,
`web`. Named volumes: `postgres_data`, `redis_data`, `uploads_data`.

---

## 4. Repository layout

```
taprivo/
├─ backend/                 # Fastify API (TypeScript)
│  ├─ src/
│  │  ├─ server.ts          # entry: plugins, decorators, boot (migrate + seed + listen)
│  │  ├─ env.ts             # env var parsing/validation + defaults
│  │  ├─ db.ts              # pg pool, query(), tx()
│  │  ├─ migrate.ts         # idempotent schema migrations (run every boot)
│  │  ├─ seed.ts            # demo data if DB empty
│  │  ├─ routes/            # auth, cards, qr, nfc, rewards, merchants, admin, wallet
│  │  └─ services/          # stampEngine, walletService, rewardService, nfcService,
│  │                        # geoFenceService, qrTokenService, refreshTokenService,
│  │                        # authCodeService, emailService, stampGridImage
│  ├─ db/init.sql           # initial schema (runs once on a fresh Postgres volume)
│  └─ Dockerfile            # ⚠ currently dev mode (tsx) — see §9.3
├─ web/                     # React PWA (merchant + admin consoles, client web)
│  ├─ src/ (pages/{admin,merchant,…}, lib/{api,auth})
│  ├─ Dockerfile            # multi-stage: vite build → nginx
│  └─ nginx.conf            # SPA fallback + /api proxy to backend:3000
├─ mobile/                  # Flutter app (customers + merchant scanning)
│  ├─ lib/ (core/, features/, models/, widgets/)
│  └─ android/, ios/
├─ docker-compose.yml       # ⚠ dev-oriented (mounts src, cleartext) — see §9
├─ .env.example             # all compose/runtime variables
├─ README.md                # quickstart + demo accounts
└─ architecture.md          # long-form design spec
```

---

## 5. Domain model (PostgreSQL)

Initial schema in `backend/db/init.sql`; additive migrations in
`backend/src/migrate.ts` apply on every boot (no separate migration CLI).
Requires extensions `uuid-ossp` and `postgis`.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | All accounts | `email` UNIQUE, `password_hash`, `role` (client/merchant/admin), `status`, `email_verified`, `device_id` |
| `merchants` | Loyalty venues | `slug` UNIQUE, `lat`/`lng`, `geofence_radius_m`, `stamps_required`, `reward_description`, `nfc_secret_key`, `nfc_enabled`, brand colors, `logo_url`, `google_class_id` |
| `loyalty_cards` | One card per (user, merchant) | `stamps_count` (capped), `total_stamps_earned`, `google_object_id`; UNIQUE(user_id, merchant_id) |
| `stamp_events` | Audit log of stamps | `method` (nfc/qr), `scan_lat`/`scan_lng`, `geo_verified`, `scanned_at` |
| `rewards` | Coupons | `coupon_code` UNIQUE, `redeemed`, `redeemed_at`, `expires_at` |
| `nfc_devices` | Provisioned tags | `uid` UNIQUE, `device_type`, `label`, `status` (active/revoked), `last_used_at` |
| `refresh_tokens` | Rotating sessions | `token_hash` (SHA-256), `device_id`, `expires_at`, `revoked_at`, `replaced_by` |

Durable state lives in Postgres. Redis holds only ephemeral data (one-time QR
tokens ~60 s, email/reset codes ~15 min).

---

## 6. API surface (high level)

All under the backend origin; the web app reaches it via the nginx `/api` proxy,
the mobile app via `API_BASE_URL`. Auth = `Authorization: Bearer <access JWT>`;
all clients also send `X-Device-Id`.

- **Auth** (`/auth/*`): signup, login, google, refresh, logout, me,
  verify-email, resend-code, forgot-password, reset-password.
- **Cards** (`/cards`, `/cards/:id`, `/cards/join`) and public `/merchants`.
- **QR**: `POST /qr/generate` (client), `POST /qr/validate` (merchant).
- **NFC**: `POST /nfc/validate` (earn stamp), `POST /nfc/redeem` (redeem reward),
  `POST /nfc/simulate` (dev helper). Coordinates are optional; geofence is
  enforced only when they are present.
- **Rewards**: `GET /rewards` (client), `POST /rewards/redeem` (merchant).
- **Merchants** (`/merchants/me/*`): config, logo, stats, history, customers,
  and NFC device provisioning/patch/revoke.
- **Admin** (`/admin/*`): users & merchants CRUD, stats, activity, NFC.
- **Wallet**: `POST /wallet/google/:cardId` (save URL), `GET /wallet/grid/:cardId`
  (PNG hero image).
- **Health**: `GET /health` → `{ status: "ok", uptime }`.

---

## 7. Environment variables (full reference)

These map 1:1 to `.env.example` and `backend/src/env.ts`. Generate each secret
with `openssl rand -hex 32`.

### Required (backend won't be secure without these)

| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://taprivo:pass@postgres:5432/taprivo` | In compose it's built from `POSTGRES_*` |
| `REDIS_URL` | `redis://redis:6379` | |
| `JWT_SECRET` | 64 hex chars | Access-token signing |
| `JWT_REFRESH_SECRET` | 64 hex chars | Refresh-token signing |
| `QR_HMAC_SECRET` | 64 hex chars | One-time QR token integrity |
| `NFC_HMAC_SECRET` | 64 hex chars | NFC challenge verification (future active tags) |

### Important for production

| Var | Default | Set to |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | leave 3000 (proxy in front) |
| `CORS_ORIGIN` | `*` | exact web origin(s), comma-separated, e.g. `https://app.taprivo.com` |
| `PUBLIC_BASE_URL` | empty | `https://api.taprivo.com` (so Google Wallet can fetch `/uploads` logos) |
| `ACCESS_TTL` | `15m` | keep short |
| `REFRESH_TTL_DAYS` | `30` | |
| `ENFORCE_DEVICE_BINDING` | `false` | `true` to bind sessions to `X-Device-Id` (anti account-sharing) |
| `UPLOAD_DIR` | `<cwd>/uploads` | a mounted volume path |
| `MAX_UPLOAD_BYTES` | `2000000` | |
| `QR_TTL_SECONDS` | `60` | |
| `REWARD_TTL_HOURS` | `720` (30 d) | reward validity after a card fills |

### Optional integrations

| Group | Vars | Behavior if unset |
|---|---|---|
| Google Wallet | `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_JSON` *or* `GOOGLE_WALLET_SA_FILE` | wallet routes return 503 |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated: web + Android) | `/auth/google` returns 503 |
| SMTP email | `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE` (false), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_NAME` | codes are logged to console |

### Web build-time

| Var | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `/api` | **Baked into the bundle at build time.** With the bundled nginx proxy, keep `/api`. Only change it if the web app calls the API on a different origin. |

### Mobile build-time (`--dart-define`)

| Var | Default | Notes |
|---|---|---|
| `API_BASE_URL` | `http://10.0.2.2:3000` | Set to `https://api.taprivo.com` for release |
| `GOOGLE_SERVER_CLIENT_ID` | — | Web OAuth client ID, needed for Google Sign-In on Android |

---

## 8. Local / staging run (sanity check before prod)

```bash
cp .env.example .env          # then edit secrets
docker compose up --build
```

- Web: http://localhost:8080  ·  API: http://localhost:3000/health
- Demo accounts (seeded on empty DB), password `demo1234`:
  `admin@demo.com`, `flore@demo.com` (merchant), `karim@demo.com` (client), …

This is the development configuration. Do **not** expose it publicly as-is — see §9.

---

## 9. Hardening for production

The shipped Docker setup favors developer iteration. Before going public, apply
these four changes.

### 9.1 What is dev-only today

| Area | Current (dev) | Why it matters |
|---|---|---|
| Backend image | Runs `tsx src/server.ts` (transpile on the fly), `NODE_ENV=development` | Slower, more memory, verbose logs; should run compiled JS |
| Compose backend | Mounts `./backend/src` read-only into the container | Prod should ship an immutable image, not the host source |
| DB/Redis ports | Published to the host (5432, 6379) | Must not be internet-exposed |
| TLS | None (plain HTTP) | Public traffic must be HTTPS |
| Mobile Android | `usesCleartextTraffic=true`, release uses **debug** signing | Cleartext must go; Play Store needs a real keystore |
| Mobile iOS | `NSAllowsLocalNetworking=true` | Remove for release |

### 9.2 Production backend Dockerfile

Replace `backend/Dockerfile` (or add `backend/Dockerfile.prod`) so it compiles
and runs as a non-root user on built JS:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY db ./db
RUN npm run build                      # tsc → dist/

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY db ./db
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/uploads && chown -R app /app/uploads
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/server.js"]
```

> Confirm `package.json` has `"build": "tsc"` and `"start": "node dist/server.js"`.
> The schema is created/migrated automatically on boot, and `db/init.sql` is also
> applied by Postgres on a fresh volume.

### 9.3 Production compose override

Create `docker-compose.prod.yml` and run with
`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`:

```yaml
services:
  postgres:
    ports: []                       # do not publish to host
  redis:
    ports: []                       # do not publish to host
  backend:
    build:
      dockerfile: Dockerfile        # or Dockerfile.prod (the §9.2 image)
    environment:
      NODE_ENV: production
      CORS_ORIGIN: https://app.taprivo.com
      PUBLIC_BASE_URL: https://api.taprivo.com
      ENFORCE_DEVICE_BINDING: "true"
    volumes:
      - uploads_data:/app/uploads    # keep ONLY the uploads volume
      - ./backend/secrets:/app/secrets:ro
    ports: []                        # reached only via the proxy
  web:
    build:
      args:
        VITE_API_URL: /api
    ports:
      - "80:80"
```

The key edits: drop the `./backend/src` bind mount (ship the image), unpublish
DB/Redis/backend ports, and set production env. Put TLS in front (§9.4).

### 9.4 TLS / reverse proxy

The `web` container already serves the SPA and proxies `/api` → `backend:3000`
over HTTP inside the Docker network. For public HTTPS, terminate TLS in front of
it. Two common options:

- **Caddy (simplest, auto Let's Encrypt).** Point a small Caddy container or host
  install at the `web` service:

  ```
  app.taprivo.com {
      reverse_proxy web:80
  }
  ```

  Caddy obtains and renews certificates automatically. Expose only 80/443 from
  the host; keep `web` internal (remove its `80:80` host publish and let Caddy
  reach it on the Docker network).

- **Cloud load balancer / managed TLS** (e.g. behind a provider's HTTPS LB or
  Cloudflare) terminating TLS and forwarding to `web:80`.

If you split the API onto its own subdomain (`api.taprivo.com`) instead of the
`/api` proxy, set `CORS_ORIGIN` to the web origin and build the web app with
`VITE_API_URL=https://api.taprivo.com`.

### 9.5 Secrets & data

- Generate the four secrets fresh for production (`openssl rand -hex 32`); never
  reuse the `.env.example` placeholders.
- Mount the Google Wallet service-account JSON at
  `./backend/secrets/google-wallet-sa.json` and set `GOOGLE_WALLET_SA_FILE`.
- Back up the `postgres_data` volume and the `uploads_data` volume (see §13).

---

## 10. Step-by-step: single-VPS production deploy

Target: one Linux VPS (e.g. 2 vCPU / 4 GB), Docker + Compose installed, a domain
pointing at it.

1. **DNS** — create `A` records: `app.taprivo.com` (and `api.taprivo.com` if you
   split the API) → the VPS IP.
2. **Clone & configure**
   ```bash
   git clone <repo> taprivo && cd taprivo
   cp .env.example .env
   # edit .env: set NODE_ENV=production, the 4 secrets, strong POSTGRES_PASSWORD,
   # CORS_ORIGIN=https://app.taprivo.com, PUBLIC_BASE_URL=https://api.taprivo.com
   ```
3. **Add the production files** from §9.2–9.4 (`Dockerfile.prod`,
   `docker-compose.prod.yml`, Caddy config).
4. **Build & start**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
5. **Verify** (see §12). The DB schema and demo seed run automatically on first
   boot.
6. **Create the real admin** and remove/disable demo accounts (the seed only
   runs while the DB is empty, but delete demo users via the admin console once
   you have your own admin).
7. **Set up backups** (§13) and **monitoring** of `GET /health`.

---

## 11. Mobile app release

### Android (Google Play)

1. **Production config edits**
   - In `mobile/android/app/src/main/AndroidManifest.xml`, remove
     `android:usesCleartextTraffic="true"` (API is HTTPS in prod).
   - Create a release keystore and wire signing in
     `mobile/android/app/build.gradle.kts`:
     ```bash
     keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 \
       -validity 10000 -alias taprivo-release
     ```
     ```kotlin
     signingConfigs {
         create("release") {
             keyAlias = System.getenv("KEY_ALIAS")
             keyPassword = System.getenv("KEY_PASSWORD")
             storeFile = file(System.getenv("KEYSTORE_PATH"))
             storePassword = System.getenv("STORE_PASSWORD")
         }
     }
     buildTypes { getByName("release") { signingConfig = signingConfigs.getByName("release") } }
     ```
   - Bump `version:` in `pubspec.yaml` for each release (e.g. `1.0.0+1`).
2. **Build the App Bundle**
   ```bash
   cd mobile
   flutter build appbundle --release \
     --dart-define=API_BASE_URL=https://api.taprivo.com \
     --dart-define=GOOGLE_SERVER_CLIENT_ID=<web-oauth-client-id>.apps.googleusercontent.com
   ```
   Output: `build/app/outputs/bundle/release/app-release.aab` → upload to Play
   Console. (Use `flutter build apk --release …` for direct-install APKs.)
3. **Google Sign-In** — register the app's SHA-1/SHA-256 (from the release
   keystore) in the Google Cloud OAuth client.

### iOS (App Store) — when you have a Mac + Apple Developer account

- Remove `NSAllowsLocalNetworking` from `ios/Runner/Info.plist`.
- Keep the NFC and location usage strings (already present, in French).
- Add the **Near Field Communication Tag Reading** capability and entitlement
  in Xcode; set the team/bundle id.
- Build: `flutter build ipa --release --dart-define=API_BASE_URL=https://api.taprivo.com --dart-define=GOOGLE_SERVER_CLIENT_ID=…`, then upload via Xcode/Transporter.

> NFC note: Android supports the hands-free continuous reader used by the card &
> reward screens. iOS only reads NFC in a foreground session — expect a tap-to-
> scan UX there.

---

## 12. Post-deploy verification (smoke test)

```bash
# API up
curl -s https://api.taprivo.com/health         # {"status":"ok",...}  (or https://app.taprivo.com/api/health)

# CORS reflects only your web origin (not *)
curl -si -H "Origin: https://app.taprivo.com" https://app.taprivo.com/api/merchants | grep -i access-control-allow-origin
```

Then, through the UI:
1. Web: log in as your admin, create a merchant + its owner.
2. Web (merchant): provision an NFC tag with the **real** tag UID (read it on
   Android via the admin/merchant "read tag", or paste the `UID lu` the mobile
   app shows on tap).
3. Mobile (client): join the program, open the card, have the merchant tap the
   tag → stamp added (haptics + animation). Fill the card → reward → open reward
   → tap to redeem → card resets.
4. Confirm a `stamp_events` row and a `rewards` row exist (admin activity feed).

---

## 13. Operations

- **Health/monitoring:** poll `GET /health`; alert on non-200. Backend logs are
  structured JSON (Pino) — ship them to your log stack.
- **Database backups:**
  ```bash
  docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
  ```
  Schedule daily; test a restore. Also snapshot the `uploads_data` volume
  (merchant logos).
- **Restore:** `gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"`.
- **Updates:** `git pull && docker compose -f … -f … up -d --build`. Migrations
  are additive and run on boot; still back up first.
- **Scaling:** the API is stateless (sessions live in Postgres/Redis), so it can
  run multiple replicas behind the proxy. Postgres and Redis are the stateful
  tier — use managed instances or ensure durable volumes + backups. Rate limit
  is per-IP per-instance.
- **Rotating secrets:** rotating `JWT_SECRET`/`JWT_REFRESH_SECRET` invalidates
  existing sessions (users re-login). Do it intentionally.

---

## 14. Security checklist before public launch

- [ ] Fresh, unique values for `JWT_SECRET`, `JWT_REFRESH_SECRET`,
      `QR_HMAC_SECRET`, `NFC_HMAC_SECRET`; strong `POSTGRES_PASSWORD`.
- [ ] `NODE_ENV=production`; `CORS_ORIGIN` set to exact origins (not `*`).
- [ ] Postgres/Redis/backend ports **not** published to the host; only 80/443
      public.
- [ ] HTTPS everywhere (proxy with valid certs); HSTS at the proxy.
- [ ] Backend runs compiled JS as non-root; `./backend/src` bind mount removed.
- [ ] Mobile: cleartext disabled, release signed with a safeguarded keystore,
      `API_BASE_URL` is the HTTPS production API.
- [ ] Demo accounts removed; a real admin created.
- [ ] Database + uploads backups scheduled and a restore tested.
- [ ] (Optional) `ENFORCE_DEVICE_BINDING=true` if you want anti account-sharing.
- [ ] Google Wallet / OAuth / SMTP credentials provisioned if those features are
      used; otherwise expect 503/console-logged codes.

---

## 15. Known limitations / notes

- **Migrations** run on every boot and are additive only (no down-migrations,
  no separate CLI). Review `migrate.ts` before deploying schema-affecting changes.
- **NFC trust model (v1):** passive tags are trusted by provisioned UID +
  optional geofence; there is no per-tap cryptographic challenge yet
  (`challenge`/`hmac` are accepted but optional, reserved for future active
  devices). Geofence is enforced only when the client sends coordinates.
- **Rate limiting** is in-memory per instance; with multiple replicas, limits
  are per-replica.
- **iOS** has not been validated on hardware in this environment; treat the iOS
  release path as "configured, needs a Mac build + Apple account".
- The bundled `web` nginx is a fine production static server + API proxy; the
  only missing piece for public use is TLS termination in front of it (§9.4).
```
