# Taprivo — E2E tests

Playwright tests covering the full app: smoke, auth, client flow, merchant flow, admin flow.

## Prerequisites

The Docker stack must be running:

```powershell
docker compose up -d
```

The tests target `http://localhost:8080` by default (override with `BASE_URL`).

## Install

```powershell
cd e2e
npm install
npm run install:browsers   # downloads Chromium (~150 MB)
```

## Run

```powershell
npm test                   # all tests, headless
npm run test:headed        # see the browser
npm run test:ui            # interactive UI mode (recommended for debugging)
npm run test:smoke         # quick health checks only
npm run report             # open the last HTML report
```

Run a single file or grep a name:

```powershell
npx playwright test smoke.spec.ts
npx playwright test -g "admin"
```

## Layout

```
e2e/
├── playwright.config.ts        # baseURL, projects (chromium-desktop + mobile-iphone)
├── fixtures/
│   ├── accounts.ts             # demo credentials (karim, sarah, flore, …, admin)
│   └── login.ts                # login() via UI + loginViaApi() shortcut
└── tests/
    ├── smoke.spec.ts           # health, manifest, redirect to /login
    ├── auth.spec.ts            # role-based login + redirects + signup
    ├── client.spec.ts          # cards list, card detail, NFC simulate, QR, rewards
    ├── merchant.spec.ts        # dashboard, config persistence, NFC provisioning
    └── admin.spec.ts           # global KPIs, suspend/reactivate, filter/search users
```

## Notes

- Tests assume the seed has run (the 6 demo accounts + 3 merchants must exist). If you wiped the volume, restart the stack and let `seedIfEmpty` run.
- The `merchant — config persistence` test mutates Café Flore's reward description. If you care about reset, run `docker compose down -v && up` before re-running.
- The `admin — suspend/reactivate` test toggles "Le Bistrot" status. It restores at the end, but if it fails mid-way, manually reactivate from `/admin/merchants`.
- Mobile project uses iPhone 13 viewport — useful for catching the bottom-nav + safe-area + h-dvh edge cases.
