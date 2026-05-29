# Application Carte de Fidélité — Architecture Globale

> Plateforme multi-établissements (restaurants & cafés) avec carte de fidélité numérique, tampons NFC physiques et anti-fraude par géolocalisation.

---

## 1. Vue d'ensemble du projet

### 1.1 Objectif

Permettre à chaque restaurant ou café de proposer à ses clients une **carte de fidélité 100% digitale** :

- **10 visites = 1 récompense** (modèle tampons)
- Accumulation des tampons via **gadget NFC physique** posé sur le comptoir (ou bracelet, sticker, totem)
- **Fallback QR Code** dynamique avec géolocalisation obligatoire pour les téléphones sans NFC
- **Multi-établissements** : chaque resto a son propre espace, ses propres tampons, sa propre récompense
- **Intégration Apple Wallet + Google Wallet** : ajouter la carte au porte-cartes natif du téléphone
- Disponible en **Web (PWA)**, **iOS** et **Android**

### 1.2 Tampons NFC physiques

Chaque restaurant reçoit un ou plusieurs **gadgets NFC physiques** :

| Type de gadget | Usage | Avantage |
|---|---|---|
| Sticker NFC | Collé sur la caisse, le comptoir, ou la table | Discret, peu coûteux |
| Totem NFC | Posé visiblement à la sortie | Marketing, attire l'attention |
| Carte NFC | Tenue en main par le serveur | Contrôle total du moment du tampon |
| Bracelet NFC | Porté par le serveur | Mobilité maximale |

Le client **approche son téléphone** du gadget → l'app détecte le tap → un tampon est ajouté instantanément. **Aucune connexion internet requise du côté du gadget** (le gadget est passif).

### 1.3 Anti-fraude

| Mécanisme | Protection contre |
|---|---|
| QR dynamique TTL 60s | Capture d'écran réutilisée plus tard |
| Géofence GPS 100m | Scan depuis chez soi ou hors-site |
| Token usage unique | Double scan du même QR |
| Challenge-response NFC | Clonage du gadget NFC |
| Device binding | Compte partagé entre plusieurs téléphones |

---

## 2. Architecture globale

### 2.1 Schéma général

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Web App    │    │  iOS App     │    │ Android App  │
│  (React PWA) │    │ (React Nat.) │    │ (React Nat.) │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └─────────┬─────────┴─────────┬─────────┘
                 │                   │
            HTTPS / REST        Apple/Google
                 │                Wallet API
                 │                   │
         ┌───────▼─────────┐         │
         │  API Gateway    │         │
         │  (Nginx/Cloud)  │         │
         └───────┬─────────┘         │
                 │                   │
       ┌─────────▼──────────────────▼────┐
       │   Backend Node.js + Fastify     │
       │                                 │
       │  ┌─────┐ ┌─────┐ ┌─────┐ ┌────┐│
       │  │Auth │ │QR   │ │NFC  │ │Wal-││
       │  │     │ │Token│ │Vault│ │let ││
       │  └─────┘ └─────┘ └─────┘ └────┘│
       │  ┌─────────┐ ┌──────────────┐  │
       │  │Stamps   │ │Merchant API  │  │
       │  │Engine   │ │              │  │
       │  └─────────┘ └──────────────┘  │
       └────┬───────────────────┬───────┘
            │                   │
       ┌────▼──────┐      ┌─────▼─────┐
       │PostgreSQL │      │  Redis    │
       │+ PostGIS  │      │  Cache    │
       └───────────┘      └───────────┘
```

### 2.2 Composants principaux

| Composant | Rôle | Technologie |
|---|---|---|
| API Gateway | Entrée unique, rate limiting, SSL | Nginx ou Cloudflare |
| Backend API | Logique métier, auth, anti-fraude | Node.js + Fastify + TypeScript |
| Base de données | Données persistantes | PostgreSQL 16 + PostGIS |
| Cache | Tokens QR temporaires (TTL 60s) | Redis 7 |
| Wallet Service | Génération .pkpass / Google Pay | apple-pkpass + google-pay-api |
| Push Notifications | Récompense débloquée, expiration | Firebase Cloud Messaging |
| Object Storage | Logos restaurants, photos | AWS S3 ou MinIO |

---

## 3. Architecture Backend

### 3.1 Structure des dossiers

```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts              # Login, signup, refresh
│   │   ├── cards.ts             # CRUD cartes de fidélité
│   │   ├── qr.ts                # Génération + validation QR
│   │   ├── nfc.ts               # Validation tap NFC
│   │   ├── rewards.ts           # Récompenses débloquées
│   │   ├── merchants.ts         # Dashboard gérant
│   │   └── wallet.ts            # Apple/Google Wallet
│   ├── services/
│   │   ├── qrTokenService.ts    # Génération HMAC, Redis TTL
│   │   ├── geoFenceService.ts   # Calcul distance Haversine
│   │   ├── stampEngine.ts       # Logique 10 tampons = 1 récompense
│   │   ├── walletService.ts     # Construction .pkpass et JWT Google
│   │   └── nfcService.ts        # Validation challenge-response
│   ├── db/
│   │   ├── schema.sql           # Schéma PostgreSQL
│   │   └── migrations/
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   ├── rateLimit.ts
│   │   └── deviceBinding.ts
│   ├── workers/
│   │   ├── walletPushUpdates.ts # Met à jour les wallets quand un tampon est ajouté
│   │   └── tokenCleanup.ts
│   └── server.ts
├── certificates/
│   ├── apple-pass-cert.p12
│   └── google-wallet-sa.json
├── tests/
└── package.json
```

### 3.2 Endpoints API principaux

| Méthode | Endpoint | Description |
|---|---|---|
| POST | /auth/signup | Création compte client |
| POST | /auth/login | Connexion |
| POST | /auth/refresh | Rafraîchir le JWT |
| GET | /cards | Liste des cartes du client |
| GET | /cards/:id | Détail d'une carte |
| POST | /qr/generate | Générer QR dynamique TTL 60s |
| POST | /qr/validate | Caissier valide un QR scanné |
| POST | /nfc/validate | Validation d'un tap NFC |
| GET | /rewards | Récompenses disponibles |
| POST | /rewards/:id/redeem | Utiliser une récompense |
| GET | /merchants/:id | Infos d'un restaurant |
| POST | /merchants | Créer un compte gérant |
| GET | /merchants/me/stats | Stats du restaurant |
| POST | /merchants/me/nfc/provision | Provisionner un gadget NFC |
| POST | /wallet/apple/:cardId | Télécharger .pkpass |
| POST | /wallet/google/:cardId | Générer lien Google Wallet |
| POST | /wallet/apple/webhook | Mises à jour Apple Wallet |

### 3.3 Flux de validation d'un tap NFC

```
1. Client tape son téléphone sur le gadget NFC du resto
2. App lit l'UID + challenge cryptographique du gadget
3. App POST /nfc/validate { merchant_uid, challenge, user_id, gps }
4. Backend → récupère merchant.nfc_secret_key depuis NFC Vault
5. Backend vérifie HMAC(challenge, secret_key) == valeur attendue
6. Backend vérifie distance GPS ≤ geofence_radius_m
7. Backend INSERT stamp_event
8. Backend incrémente loyalty_cards.stamps_count
9. Si stamps_count >= stamps_required → générer reward
10. Backend déclenche push wallet (mise à jour visuelle du pass)
11. Retour 200 OK + état mis à jour
```

### 3.4 Flux de validation d'un QR

```
1. Client demande POST /qr/generate
2. Backend crée token = HMAC-SHA256(user + merchant + timestamp, SECRET)
3. Backend stocke dans Redis : SETEX qr:{token} 60 {payload}
4. App affiche le QR + countdown 60s
5. Caissier scanne le QR avec son app dédiée
6. App caissier POST /qr/validate { token, scan_lat, scan_lng }
7. Backend GET qr:{token} → vérifie existence + non-expiré
8. Backend vérifie distance Haversine ≤ 100m du resto
9. Backend DELETE qr:{token} (usage unique)
10. Même flux que NFC à partir d'ici (stamp + reward + wallet push)
```

---

## 4. Architecture Web (PWA)

### 4.1 Structure

```
web-client/
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── CardsPage.tsx
│   │   ├── CardDetailPage.tsx
│   │   ├── ScanPage.tsx
│   │   ├── RewardsPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── merchant/
│   │       ├── DashboardPage.tsx
│   │       ├── StampsHistoryPage.tsx
│   │       ├── NfcProvisioningPage.tsx
│   │       └── RewardsConfigPage.tsx
│   ├── components/
│   │   ├── StampCard.tsx
│   │   ├── QRDisplay.tsx
│   │   ├── NFCInstructions.tsx
│   │   ├── WalletButtons.tsx
│   │   └── RewardBanner.tsx
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   ├── useWebNFC.ts          # Web NFC API (Chrome Android)
│   │   ├── useQRTimer.ts
│   │   └── useAuth.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── walletService.ts
│   └── App.tsx
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── service-worker.js         # Cache offline
│   └── icons/
└── vite.config.ts
```

### 4.2 Stack technique

- React 18 + TypeScript
- Vite (bundler)
- TailwindCSS
- React Router v6
- TanStack Query (cache des appels API)
- PWA via vite-plugin-pwa
- Web NFC API pour Chrome Android (fallback QR pour iOS Safari)
- Web Geolocation API

### 4.3 Espaces

Deux espaces distincts dans la même PWA :

- **Espace client** : `/app/*` — voir ses cartes, scanner, récompenses
- **Espace gérant** : `/merchant/*` — dashboard, statistiques, gestion des récompenses

---

## 5. Architecture iOS

### 5.1 Structure (React Native + modules natifs)

```
ios-app/
├── src/                          # Code React Native partagé
│   ├── screens/
│   │   ├── CardsListScreen.tsx
│   │   ├── CardDetailScreen.tsx
│   │   ├── ScanScreen.tsx
│   │   ├── RewardsScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── components/
│   ├── native/
│   │   ├── NFCReader.ts          # Bridge → Swift CoreNFC
│   │   ├── AppleWallet.ts        # Bridge → PassKit
│   │   └── ScreenshotDetector.ts
│   ├── hooks/
│   └── App.tsx
├── ios/
│   ├── LoyaltyApp/
│   │   ├── NFCReaderModule.swift # Lit les tags NFC via CoreNFC
│   │   ├── WalletModule.swift    # Ajoute .pkpass à Apple Wallet
│   │   ├── Info.plist            # NFCReaderUsageDescription
│   │   └── LoyaltyApp.entitlements
│   └── Podfile
└── package.json
```

### 5.2 Fonctionnalités iOS spécifiques

- **CoreNFC** : Lire les tags NFC (iPhone 7+, NDEF + ISO 14443)
- **PassKit** : Ajouter une carte à Apple Wallet en un tap
- **Background NFC scanning** (iPhone XS+) : tap sans ouvrir l'app
- **Localisation précise** via CoreLocation
- **Detection de screenshot** via UIApplicationUserDidTakeScreenshotNotification
- **Notifications push** quand la récompense est débloquée

### 5.3 Permissions Info.plist

```xml
<key>NFCReaderUsageDescription</key>
<string>Approchez votre téléphone du badge du restaurant pour cumuler vos tampons</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>La géolocalisation est utilisée pour valider votre présence au restaurant</string>
<key>NSCameraUsageDescription</key>
<string>Caméra utilisée pour scanner le QR code du restaurant</string>
```

---

## 6. Architecture Android

### 6.1 Structure (React Native + modules natifs)

```
android-app/
├── src/                          # Code React Native partagé
│   └── (identique à iOS)
├── android/
│   ├── app/src/main/
│   │   ├── java/com/loyaltyapp/
│   │   │   ├── NFCReaderModule.kt    # NfcAdapter HostCardEmulation
│   │   │   ├── WalletModule.kt       # Google Wallet API
│   │   │   └── ScreenshotDetector.kt
│   │   └── AndroidManifest.xml
│   └── build.gradle
└── package.json
```

### 6.2 Fonctionnalités Android spécifiques

- **NfcAdapter** : Lecture NDEF, IsoDep, MifareClassic
- **Google Wallet API** : Ajouter une carte avec lien JWT signé
- **FusedLocationProviderClient** : Géolocalisation précise
- **FLAG_SECURE** sur les écrans QR pour bloquer les screenshots
- **Firebase Cloud Messaging** pour les notifications
- **CameraX** pour scanner les QR Code

### 6.3 Permissions AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

---

## 7. Apple Wallet & Google Wallet

### 7.1 Apple Wallet (.pkpass)

Un fichier `.pkpass` est généré par le backend et téléchargé par le client.

**Structure d'un .pkpass :**

```
pass.pkpass (ZIP)
├── pass.json              # Métadonnées de la carte
├── icon.png / @2x / @3x
├── logo.png / @2x / @3x
├── strip.png              # Bandeau visuel
├── manifest.json          # SHA-1 de chaque fichier
└── signature              # Signature CMS avec certificat Apple
```

**pass.json (exemple) :**

```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.com.loyaltyapp.card",
  "serialNumber": "card_uuid_here",
  "teamIdentifier": "TEAMID12345",
  "organizationName": "Loyalty App",
  "description": "Carte de fidélité Café Flore",
  "logoText": "Café Flore",
  "foregroundColor": "rgb(255,255,255)",
  "backgroundColor": "rgb(83,74,183)",
  "storeCard": {
    "primaryFields": [
      { "key": "stamps", "label": "Tampons", "value": "7/10" }
    ],
    "secondaryFields": [
      { "key": "reward", "label": "Récompense", "value": "1 plat offert" }
    ],
    "backFields": [
      { "key": "address", "label": "Adresse", "value": "12 rue de la Paix, Tunis" }
    ]
  },
  "barcode": {
    "format": "PKBarcodeFormatQR",
    "message": "card:uuid:dynamic_token",
    "messageEncoding": "iso-8859-1"
  },
  "webServiceURL": "https://api.loyaltyapp.com/wallet/apple/",
  "authenticationToken": "secret_per_user"
}
```

**Mises à jour automatiques** : à chaque tampon ajouté, le backend envoie une push APNs au pass, qui appelle `/wallet/apple/webhook` pour récupérer la nouvelle version. Le nombre de tampons se met à jour automatiquement dans Apple Wallet.

### 7.2 Google Wallet

Google Wallet utilise des **JWT signés** pour ajouter une carte.

**Flux :**

1. Backend appelle l'API Google Wallet pour créer un `LoyaltyClass` (template du restaurant)
2. Pour chaque client, backend crée un `LoyaltyObject` (instance personnalisée)
3. Backend génère un JWT signé contenant l'ID du LoyaltyObject
4. L'app affiche un bouton "Ajouter à Google Wallet" → URL : `https://pay.google.com/gp/v/save/{JWT}`
5. Au clic, Google Wallet ajoute la carte automatiquement

**LoyaltyObject (exemple) :**

```json
{
  "id": "issuer_id.card_uuid",
  "classId": "issuer_id.cafe_flore_class",
  "state": "ACTIVE",
  "accountName": "Karim B.",
  "loyaltyPoints": {
    "label": "Tampons",
    "balance": { "string": "7/10" }
  },
  "barcode": {
    "type": "QR_CODE",
    "value": "card:uuid:dynamic_token"
  },
  "locations": [
    { "latitude": 36.8065, "longitude": 10.1815 }
  ]
}
```

Quand le client est à proximité du restaurant (locations match), Google Wallet **fait remonter la carte automatiquement** sur l'écran de verrouillage.

### 7.3 Bouton "Ajouter au Wallet" — Logique

```
iOS    → Bouton "Ajouter à Apple Wallet"
       → Télécharge .pkpass → PassKit l'ouvre nativement

Android → Bouton "Ajouter à Google Wallet"
        → Ouvre URL pay.google.com/gp/v/save/JWT
        → Google Wallet ajoute la carte

Web    → Détecte le user-agent
        → iOS Safari → bouton Apple Wallet
        → Android Chrome → bouton Google Wallet
        → Desktop → message "Téléchargez l'app"
```

---

## 8. Schéma de base de données

```
users
├── id (uuid, PK)
├── full_name
├── phone (unique)
├── email
├── device_id           — Anti partage de compte
├── password_hash
└── created_at

merchants
├── id (uuid, PK)
├── name
├── address
├── lat, lng            — Pour le géofence
├── geofence_radius_m   — Défaut 100m
├── stamps_required     — Défaut 10
├── reward_description
├── nfc_secret_key      — Chiffré au repos
├── nfc_enabled
├── apple_pass_template_id
├── google_class_id
├── logo_url
└── created_at

loyalty_cards
├── id (uuid, PK)
├── user_id (FK → users)
├── merchant_id (FK → merchants)
├── stamps_count
├── total_stamps_earned
├── last_visit_at
├── apple_pass_serial
├── google_object_id
└── created_at

stamp_events
├── id (uuid, PK)
├── card_id (FK → loyalty_cards)
├── method              — 'nfc' | 'qr'
├── scan_lat, scan_lng
├── qr_token_used       — null si NFC
├── geo_verified
└── scanned_at

qr_tokens (cache Redis avec TTL 60s)
├── token_hash (clé Redis)
├── user_id
├── merchant_id
├── used
├── expires_at
└── created_at

rewards
├── id (uuid, PK)
├── card_id (FK)
├── user_id (FK)
├── merchant_id (FK)
├── coupon_code
├── redeemed
├── redeemed_at
└── expires_at

nfc_devices
├── id (uuid, PK)
├── merchant_id (FK)
├── uid                 — UID unique du gadget
├── device_type         — 'sticker' | 'totem' | 'card' | 'bracelet'
├── provisioned_at
├── last_used_at
└── status              — 'active' | 'revoked'
```

---

## 9. Maquette UI — Client mobile

### 9.1 Écran d'accueil (liste des cartes)

```
╔════════════════════════════╗
║ Bonjour, Karim             ║
║ 3 cartes actives           ║
╠════════════════════════════╣
║                            ║
║  MES CARTES                ║
║                            ║
║  ┌──────────────────────┐  ║
║  │ [CF] Café Flore      │  ║
║  │      7/10 tampons    │  ║
║  │      ●●●●●●●○○○      │  ║
║  └──────────────────────┘  ║
║                            ║
║  ┌──────────────────────┐  ║
║  │ [LB] Le Bistrot      │  ║
║  │      3/10 tampons    │  ║
║  │      ●●●○○○○○○○      │  ║
║  └──────────────────────┘  ║
║                            ║
║  ┌──────────────────────┐  ║
║  │ [SP] Sushi Palace  🎁│  ║
║  │      10/10 ! RECOMP. │  ║
║  │      ●●●●●●●●●●      │  ║
║  └──────────────────────┘  ║
║                            ║
║  [+ Rejoindre un resto]    ║
║                            ║
╠════════════════════════════╣
║ Cartes  Scan  Offres  Prof ║
╚════════════════════════════╝
```

### 9.2 Écran détail carte + scan

```
╔════════════════════════════╗
║ Café Flore                 ║
║ 200m — Porte de Tunis      ║
╠════════════════════════════╣
║                            ║
║  Tampons         7 / 10    ║
║  ████████████░░░░░         ║
║                            ║
║  ✓ ✓ ✓ ✓ ✓                 ║
║  ✓ ✓ ○ ○ 🎁                ║
║                            ║
║  ┌──────────────────────┐  ║
║  │                      │  ║
║  │       ((( o )))      │  ║
║  │     NFC ACTIF        │  ║
║  │  Approcher du badge  │  ║
║  │                      │  ║
║  └──────────────────────┘  ║
║                            ║
║         — ou —             ║
║                            ║
║  ┌──────────────────────┐  ║
║  │       0:52           │  ║
║  │   QR dynamique       │  ║
║  │                      │  ║
║  │    [ QR CODE ]       │  ║
║  │                      │  ║
║  │  📍 GPS confirmé     │  ║
║  └──────────────────────┘  ║
║                            ║
║  [📲 Ajouter à Wallet]     ║
║                            ║
╚════════════════════════════╝
```

### 9.3 Écran récompense débloquée

```
╔════════════════════════════╗
║ Sushi Palace               ║
║ Carte complète             ║
╠════════════════════════════╣
║                            ║
║  Tampons        10 / 10    ║
║  ██████████████████        ║
║                            ║
║  ✓ ✓ ✓ ✓ ✓                 ║
║  ✓ ✓ ✓ ✓ 🎁                ║
║                            ║
║  ┌──────────────────────┐  ║
║  │ 🎁 1 plat offert     │  ║
║  │    à votre prochaine │  ║
║  │    visite !          │  ║
║  └──────────────────────┘  ║
║                            ║
║  Coupon de récompense      ║
║  ┌──────────────────────┐  ║
║  │     1:00 (TTL)       │  ║
║  │                      │  ║
║  │   [ QR COUPON ]      │  ║
║  │                      │  ║
║  │  📍 GPS requis       │  ║
║  │  Usage unique        │  ║
║  └──────────────────────┘  ║
║                            ║
╚════════════════════════════╝
```

---

## 10. Maquette UI — Dashboard gérant (Web)

### 10.1 Tableau de bord principal

```
┌────────────────────────────────────────────────────────────┐
│ [LOGO]  Café Flore — Dashboard          [Profil] [Logout] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📊 STATISTIQUES — Aujourd'hui                             │
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 47       │ │ 32       │ │ 12       │ │ 5        │       │
│  │ Visites  │ │ NFC taps │ │ QR scans │ │ Récomp.  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                            │
│  📈 VISITES — 7 derniers jours                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ▁ ▄ ▆ █ ▅ ▇ █                                       │  │
│  │  L  M  M  J  V  S  D                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  📋 DERNIERS TAMPONS                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Karim B.     NFC   12:42   ✓ GPS validé              │  │
│  │ Sarah M.     QR    12:31   ✓ GPS validé              │  │
│  │ Yacine T.    NFC   12:15   ✓ GPS validé              │  │
│  │ Anonyme      QR    11:58   ⚠ GPS refusé (1.2 km)     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 10.2 Configuration restaurant

```
┌────────────────────────────────────────────────────────────┐
│ Café Flore — Configuration                                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  TAMPONS                                                   │
│  Nombre de tampons requis : [ 10  ]                        │
│  Description récompense  : [ 1 café offert            ]    │
│                                                            │
│  GÉOFENCE                                                  │
│  Adresse : 12 rue de la Paix, Tunis                        │
│  [ Carte avec marker ]                                     │
│  Rayon : [ 100m ▼ ]                                        │
│                                                            │
│  GADGETS NFC                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Totem caisse   #A1B2  ✓ actif   Provisionné 03/2026  │  │
│  │ Sticker table  #C3D4  ✓ actif   Provisionné 03/2026  │  │
│  │ Bracelet serv. #E5F6  ✓ actif   Provisionné 04/2026  │  │
│  │ [ + Provisionner un nouveau gadget ]                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  BRANDING WALLET                                           │
│  Logo carte    : [ Upload PNG ]                            │
│  Couleur fond  : [ #534AB7 ]                               │
│  Couleur texte : [ #FFFFFF ]                               │
│  [ Aperçu Apple Wallet ] [ Aperçu Google Wallet ]          │
│                                                            │
│  [ ENREGISTRER ]                                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 11. Sécurité

| Couche | Mesure |
|---|---|
| Transport | HTTPS uniquement (TLS 1.3) + HSTS |
| Auth | JWT 15min + refresh token 30 jours |
| Device binding | Chaque JWT lié à un device_id unique |
| Tokens QR | HMAC-SHA256, TTL 60s, usage unique, stockés Redis |
| NFC | Challenge-response avec clé symétrique par gadget |
| Géofence | Validation côté serveur uniquement (jamais côté client) |
| Anti-screenshot | FLAG_SECURE Android + détection iOS |
| Rate limiting | 60 req/min par IP, 10 scan/min par user |
| Secrets | Variables d'env + AWS Secrets Manager |
| Audit | Tous les scans loggés avec coords + device + timestamp |

---

## 12. Roadmap de développement

### Phase 1 — MVP (8 semaines)
- Backend API + base de données
- App React Native (iOS + Android) — fonctions de base
- Web PWA client
- Validation NFC + QR + géofence
- Dashboard gérant minimal

### Phase 2 — Wallet & Notifications (4 semaines)
- Intégration Apple Wallet (.pkpass)
- Intégration Google Wallet (JWT)
- Push notifications (récompense débloquée)
- Mise à jour automatique des passes wallet

### Phase 3 — Multi-établissements (3 semaines)
- Dashboard gérant complet
- Provisioning NFC self-service
- Statistiques avancées
- Branding par restaurant

### Phase 4 — Optimisations (continu)
- Détection de fraude par ML
- Recommandations de restaurants proches
- Programme de parrainage
- Système d'avis et notes

---

## 13. Coûts d'infrastructure estimés (mensuel)

| Service | Volume initial | Coût |
|---|---|---|
| VPS Backend (4 vCPU, 8 Go) | Hetzner CX31 | 15 € |
| PostgreSQL managé | 1 instance 2 Go RAM | 20 € |
| Redis managé | 250 Mo | 10 € |
| Object Storage | 50 Go | 5 € |
| CDN (Cloudflare) | Plan gratuit | 0 € |
| Push APNs/FCM | Gratuit jusqu'à 1M | 0 € |
| Apple Developer Program | Obligatoire | 99 $/an |
| Google Play Console | Obligatoire | 25 $ une fois |
| Domaine | .com | 12 €/an |
| **Total mensuel** | | **~50 €/mois** |

Gadgets NFC physiques : ~0,5 € à 3 € par unité selon le type (sticker / totem / bracelet).

---

*Document généré le 27 mai 2026 — Architecture v1.0*
