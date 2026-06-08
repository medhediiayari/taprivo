import { query } from "./db.js";

// Idempotent schema steps applied at boot. `db/init.sql` only runs on a fresh
// Postgres volume, so anything added after the first deploy must also be
// expressed here to reach existing databases.
export const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash     text UNIQUE NOT NULL,
      device_id      text,
      user_agent     text,
      expires_at     timestamptz NOT NULL,
      revoked_at     timestamptz,
      replaced_by    uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id)`);

  // Email verification flag (optional verification flow). Default false.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false`);
};
