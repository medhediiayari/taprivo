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

## Notes / limits

- **Logos** must be public HTTPS for Google's servers to fetch them. Locally
  (http backend) logos are omitted from the pass unless `PUBLIC_BASE_URL` points
  to a public HTTPS deployment. Seeded picsum logos (already HTTPS) work.
- The web/mobile "Ajouter à Google Wallet" button is on the card detail screen.
- Apple Wallet is not implemented yet (needs a paid Apple Developer account +
  PassKit certificates).
