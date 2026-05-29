# Taprivo — Mobile (Flutter)

Client mobile iOS + Android, codebase Flutter unique. C'est un **client du backend
Fastify** existant (`../backend`) : mêmes endpoints REST, même modèle d'auth
(access token court + refresh token rotatif + device binding) que le web.

Voir `../architecture.md` §5–6 pour la spec.

## Prérequis

- Flutter 3.19+ / Dart 3.3+ (`flutter --version`)
- Le backend qui tourne (`docker compose up` à la racine du repo)

## Configuration

L'URL de l'API est injectée au build via `--dart-define` (équivalent de
`VITE_API_URL` côté web). Défaut : `http://10.0.2.2:3000` (l'hôte vu depuis
l'émulateur Android ; pour le simulateur iOS, utiliser `http://localhost:3000`).

```bash
flutter pub get

# Émulateur Android (10.0.2.2 = localhost de la machine hôte)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000

# Simulateur iOS
flutter run --dart-define=API_BASE_URL=http://localhost:3000

# Appareil physique : pointer vers l'IP LAN de la machine qui héberge le backend
flutter run --dart-define=API_BASE_URL=http://192.168.1.x:3000
```

## Comptes de démo (seedés par le backend)

| Rôle | Email | Mot de passe |
|---|---|---|
| Client | karim@demo.com | demo1234 |
| Client | sarah@demo.com | demo1234 |

## Architecture

```
lib/
├── main.dart                    # bootstrap ProviderScope
├── app.dart                     # MaterialApp.router + thème
├── core/
│   ├── api/                     # dio + intercepteur auth (401 → refresh single-flight)
│   ├── auth/                    # token store, repository, controller riverpod
│   ├── router.dart              # go_router + redirection selon l'auth
│   └── theme/                   # palette Taprivo
├── models/                      # User, LoyaltyCard, Reward, Merchant
└── features/
    ├── auth/                    # LoginPage
    ├── cards/                   # liste + détail
    ├── scan/                    # NFC + QR
    └── rewards/                 # récompenses
```

L'intercepteur d'auth (`core/api/auth_interceptor.dart`) **réplique** la logique du
web (`web/src/lib/api.ts`) : header `X-Device-Id`, refresh **single-flight** sur 401,
rejeu une fois, purge + redirection login en cas d'échec.

## État du scaffold

⚠️ Scaffold initial **non encore compilé/validé** sur une machine équipée du SDK
Flutter (le conteneur de dev backend n'a pas Flutter). Avant le premier run :
`flutter pub get` puis `flutter analyze`. Les dossiers `ios/`/`android/` natifs sont
générés par `flutter create .` (voir ci-dessous).

```bash
# Générer les enveloppes natives iOS/Android dans ce dossier existant :
flutter create --org com.taprivo --project-name taprivo_mobile .
```
