# Google Wallet — loyalty passes

The backend can issue **"Add to Google Wallet"** loyalty passes for a customer's
card, and keeps the stamp count in sync when new stamps are added. It's
**config-driven**: until you provide an issuer id + a service-account key, the
`/wallet/google/:cardId` route returns `503 wallet_not_configured` and the
buttons in the web/mobile apps show a "not configured" message.

## One-time Google setup

1. **Google Cloud project** → enable the **Google Wallet API**.
2. **Service account** in that project → create a **JSON key**. Note its
   `client_email`.
3. **Google Pay & Wallet Console** (https://pay.google.com/business/console):
   - Get your **Issuer ID** (a numeric id).
   - Under *Users*, grant your service-account `client_email` access to the
     issuer (so it can create classes/objects).
   - For local testing you can use the issuer in demo/test mode; new loyalty
     classes are created with `reviewStatus: UNDER_REVIEW`, which is fine for
     development and for the issuer's own test users.

## Wire it into the backend

Put the JSON key at `backend/secrets/google-wallet-sa.json` (this folder is
gitignored) and set in your root `.env`:

```bash
GOOGLE_WALLET_ISSUER_ID=3388000000000000000
GOOGLE_WALLET_SA_FILE=/app/secrets/google-wallet-sa.json
# Optional: needed so Google can fetch merchant logos (must be public HTTPS).
PUBLIC_BASE_URL=https://your-backend.example.com
```

Then rebuild: `docker compose up --build backend`.

`docker-compose.yml` already mounts `./backend/secrets` read-only into the
container at `/app/secrets`. (Alternatively, paste the key inline via
`GOOGLE_WALLET_SA_JSON` instead of using a file.)

## How it works

- `POST /wallet/google/:cardId` (auth required, must own the card):
  - Creates the merchant's **Loyalty Class** on first use (`merchants.google_class_id`),
    using the merchant name, brand background color, and logo.
  - Creates the card's **Loyalty Object** on first use (`loyalty_cards.google_object_id`),
    with the current stamp count as `loyaltyPoints` and a QR barcode of the card id.
  - Returns `{ saveUrl }` — a signed `https://pay.google.com/gp/v/save/<jwt>` link.
- When a stamp is added, the stamp engine best-effort PATCHes the object's
  points so the pass updates in the user's wallet.

## Stamp-grid banner (hero image)

The pass shows a generated **stamp-grid banner** (filled/empty circles in the
merchant's brand color) as its hero image, mirroring the in-app card. It's
served unauthenticated at `GET /wallet/grid/:cardId` and refreshes as stamps are
added (the `?v=<count>` query busts Google's image cache).

Google fetches this image **server-side over public HTTPS**, so it only renders
when `PUBLIC_BASE_URL` is a public HTTPS URL — never `http://localhost`.

### Testing the banner locally (via a tunnel)

Expose the backend over HTTPS with a tunnel, then point `PUBLIC_BASE_URL` at it:

```bash
# e.g. cloudflared (no account needed) or ngrok — tunnel to the backend port
cloudflared tunnel --url http://localhost:3000
#   -> https://random-name.trycloudflare.com
```

Set in `.env` and restart the backend:

```bash
PUBLIC_BASE_URL=https://random-name.trycloudflare.com
```

Re-press "Add to Google Wallet" (or add a stamp) and the banner appears.
**Migrating to production = just change `PUBLIC_BASE_URL`** to your real domain;
no code change. (The tunnel also makes merchant logos load, same mechanism.)

## Notes / limits

- Google Wallet passes use a **fixed template** — the exact in-app stamp grid
  (numbered circles) can't be reproduced as live widgets. The banner image is
  the closest visual; the rest (title, points, QR) follows Google's layout.

- **Logos** must be public HTTPS for Google's servers to fetch them. Locally
  (http backend) logos are omitted from the pass unless `PUBLIC_BASE_URL` points
  to a public HTTPS deployment. Seeded picsum logos (already HTTPS) work.
- The web/mobile "Ajouter à Google Wallet" button is on the card detail screen.
- Apple Wallet is not implemented yet (needs a paid Apple Developer account +
  PassKit certificates).
