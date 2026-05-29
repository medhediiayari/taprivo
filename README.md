# Taprivo — Loyalty Platform

Digital loyalty card platform for restaurants & cafés. PWA + backend, fully containerised.

See `architecture.md` for the full architecture spec.

## Quickstart

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- Web (PWA): http://localhost:8080
- Backend API: http://localhost:3000
- Postgres: localhost:5432 (taprivo / taprivo_dev)
- Redis: localhost:6379

## Demo accounts (seeded)

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Admin** | **admin@demo.com** | demo1234 | `/admin` — global dashboard, manages all |
| Client | karim@demo.com | demo1234 | `/` — cards, scan, rewards |
| Client | sarah@demo.com | demo1234 | `/` |
| Merchant (Café Flore) | flore@demo.com | demo1234 | `/merchant` |
| Merchant (Le Bistrot) | bistrot@demo.com | demo1234 | `/merchant` |
| Merchant (Sushi Palace) | sushi@demo.com | demo1234 | `/merchant` |

The admin can: view global KPIs and the 7-day stamp chart, list/create/edit/suspend/delete all restaurants and users, watch a live activity feed of stamps. Admin accounts cannot self-register — only an existing admin (or the seed) can create another admin.

## Layout

```
.
├── docker-compose.yml         # All services
├── backend/                   # Node.js + Fastify + TypeScript
│   ├── src/
│   ├── db/init.sql            # Schema (auto-loaded on first boot)
│   ├── db/seed.sql            # Demo data
│   └── Dockerfile
└── web/                       # React + Vite + Tailwind v4 + Motion PWA
    ├── src/
    └── Dockerfile             # nginx multi-stage build
```

## Development

```bash
# Backend only
docker compose up postgres redis backend

# Reset everything (drops volumes)
docker compose down -v

# Rebuild after dependency change
docker compose build --no-cache backend web
```

## Stack

- **Backend**: Node.js 20, Fastify, TypeScript, `pg`, `ioredis`, `jsonwebtoken`, `argon2`
- **Frontend**: React 18, Vite, Tailwind v4, motion/react, TanStack Query, React Router v6
- **DB**: PostgreSQL 16 + PostGIS
- **Cache**: Redis 7

## Design

Direction café/resto chaleureuse — palette méditerranéenne :

| Token | Hex | Usage |
|---|---|---|
| Sable | `#F4EBD9` | Fond papier |
| Olive nuit | `#04342C` | Texte principal, surfaces sombres |
| Olive | `#0F6E56` | Succès, validation GPS |
| Terracotta | `#D85A30` | Accent CTA principal |
| Soleil | `#EF9F27` | Highlight récompense / célébration |

Geist + Geist Mono. Pas de néon, pas de glassmorphism. Morph motions via `motion/react` `layoutId`, spring physics, animations de chiffres.
