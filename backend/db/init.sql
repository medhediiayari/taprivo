-- Taprivo schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name       text NOT NULL,
  email           text UNIQUE NOT NULL,
  phone           text UNIQUE,
  password_hash   text NOT NULL,
  device_id       text,
  role            text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'merchant', 'admin')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE merchants (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  name                     text NOT NULL,
  slug                     text UNIQUE NOT NULL,
  address                  text,
  lat                      double precision NOT NULL,
  lng                      double precision NOT NULL,
  geofence_radius_m        int NOT NULL DEFAULT 100,
  stamps_required          int NOT NULL DEFAULT 10,
  reward_description       text NOT NULL DEFAULT '1 boisson offerte',
  nfc_secret_key           text NOT NULL,
  nfc_enabled              boolean NOT NULL DEFAULT true,
  logo_url                 text,
  brand_color_bg           text NOT NULL DEFAULT '#04342C',
  brand_color_fg           text NOT NULL DEFAULT '#F4EBD9',
  brand_accent             text NOT NULL DEFAULT '#D85A30',
  apple_pass_template_id   text,
  google_class_id          text,
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchants_lat_lng_idx ON merchants(lat, lng);
CREATE INDEX merchants_status_idx ON merchants(status);

CREATE TABLE loyalty_cards (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id          uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  stamps_count         int NOT NULL DEFAULT 0,
  total_stamps_earned  int NOT NULL DEFAULT 0,
  last_visit_at        timestamptz,
  apple_pass_serial    text,
  google_object_id     text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, merchant_id)
);

CREATE INDEX loyalty_cards_user_idx ON loyalty_cards(user_id);
CREATE INDEX loyalty_cards_merchant_idx ON loyalty_cards(merchant_id);

CREATE TABLE stamp_events (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id        uuid NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  merchant_id    uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method         text NOT NULL CHECK (method IN ('nfc', 'qr')),
  scan_lat       double precision,
  scan_lng       double precision,
  qr_token_used  text,
  geo_verified   boolean NOT NULL DEFAULT false,
  scanned_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stamp_events_merchant_idx ON stamp_events(merchant_id, scanned_at DESC);
CREATE INDEX stamp_events_card_idx ON stamp_events(card_id, scanned_at DESC);

CREATE TABLE rewards (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id        uuid NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id    uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  coupon_code    text UNIQUE NOT NULL,
  redeemed       boolean NOT NULL DEFAULT false,
  redeemed_at    timestamptz,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rewards_user_idx ON rewards(user_id, redeemed);

CREATE TABLE nfc_devices (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id     uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  uid             text UNIQUE NOT NULL,
  device_type     text NOT NULL CHECK (device_type IN ('sticker', 'totem', 'card', 'bracelet')),
  label           text,
  provisioned_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX nfc_devices_merchant_idx ON nfc_devices(merchant_id);

-- Refresh tokens (rotating, one row per issued token). Tokens are stored as a
-- SHA-256 hash; the raw value is only ever returned to the client once.
CREATE TABLE refresh_tokens (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     text UNIQUE NOT NULL,
  device_id      text,                 -- device the token is bound to
  user_agent     text,
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  replaced_by    uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id);
