import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { env } from "../env.js";

// Google Wallet loyalty integration. Everything is config-driven: if no issuer
// id / service-account key is set, `walletConfigured()` is false and callers
// should return 503. See backend README for the Google Cloud setup.

const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const API_BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const SAVE_BASE = "https://pay.google.com/gp/v/save/";

export class WalletNotConfigured extends Error {
  constructor() {
    super("wallet_not_configured");
  }
}

type ServiceAccount = { client_email: string; private_key: string };

let saCache: ServiceAccount | null | undefined;
function serviceAccount(): ServiceAccount | null {
  if (saCache !== undefined) return saCache;
  try {
    if (env.GOOGLE_WALLET_SA_JSON) {
      saCache = JSON.parse(env.GOOGLE_WALLET_SA_JSON) as ServiceAccount;
    } else if (env.GOOGLE_WALLET_SA_FILE) {
      saCache = JSON.parse(readFileSync(env.GOOGLE_WALLET_SA_FILE, "utf8")) as ServiceAccount;
    } else {
      saCache = null;
    }
  } catch {
    saCache = null;
  }
  if (saCache && (!saCache.client_email || !saCache.private_key)) saCache = null;
  return saCache;
}

export function walletConfigured(): boolean {
  return Boolean(env.GOOGLE_WALLET_ISSUER_ID && serviceAccount());
}

let auth: GoogleAuth | null = null;
async function accessToken(): Promise<string> {
  const sa = serviceAccount();
  if (!sa) throw new WalletNotConfigured();
  auth ??= new GoogleAuth({
    credentials: { client_email: sa.client_email, private_key: sa.private_key },
    scopes: [SCOPE],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("wallet_auth_failed");
  return token;
}

async function walletApi(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
): Promise<Response> {
  const token = await accessToken();
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Only HTTPS, publicly reachable URLs are usable by Google's servers.
function publicLogo(logoUrl: string | null): string | undefined {
  if (!logoUrl) return undefined;
  if (/^https:\/\//i.test(logoUrl)) return logoUrl;
  if (/^https:\/\//i.test(env.PUBLIC_BASE_URL)) {
    return `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
  }
  return undefined;
}

const sanitize = (id: string) => id.replace(/[^\w.-]/g, "");

type CardRow = {
  card_id: string;
  stamps_count: number;
  stamps_required: number;
  google_object_id: string | null;
  merchant_id: string;
  merchant_name: string;
  reward_description: string;
  brand_color_bg: string;
  logo_url: string | null;
  google_class_id: string | null;
  full_name: string;
  user_id: string;
};

async function ensureClass(row: CardRow): Promise<string> {
  const classId =
    row.google_class_id || `${env.GOOGLE_WALLET_ISSUER_ID}.m_${sanitize(row.merchant_id)}`;
  const logo = publicLogo(row.logo_url);
  const body: Record<string, unknown> = {
    id: classId,
    issuerName: "Taprivo",
    programName: row.merchant_name,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: row.brand_color_bg,
    ...(logo ? { programLogo: { sourceUri: { uri: logo } } } : {}),
  };

  const get = await walletApi(`/loyaltyClass/${classId}`, "GET");
  if (get.status === 404) {
    const created = await walletApi("/loyaltyClass", "POST", body);
    if (!created.ok) throw new Error(`class_create_failed_${created.status}`);
  } else if (!get.ok) {
    throw new Error(`class_get_failed_${get.status}`);
  }
  return classId;
}

async function ensureObject(row: CardRow, classId: string): Promise<string> {
  const objectId =
    row.google_object_id || `${env.GOOGLE_WALLET_ISSUER_ID}.c_${sanitize(row.card_id)}`;
  const body: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: row.user_id,
    accountName: row.full_name,
    hexBackgroundColor: row.brand_color_bg,
    loyaltyPoints: { label: "Tampons", balance: { int: row.stamps_count } },
    barcode: { type: "QR_CODE", value: row.card_id },
    textModulesData: [{ header: "Récompense", body: row.reward_description }],
  };

  const get = await walletApi(`/loyaltyObject/${objectId}`, "GET");
  if (get.status === 404) {
    const created = await walletApi("/loyaltyObject", "POST", body);
    if (!created.ok) throw new Error(`object_create_failed_${created.status}`);
  } else if (!get.ok) {
    throw new Error(`object_get_failed_${get.status}`);
  }
  return objectId;
}

function buildSaveUrl(objectId: string): string {
  const sa = serviceAccount();
  if (!sa) throw new WalletNotConfigured();
  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    payload: { loyaltyObjects: [{ id: objectId }] },
  };
  const token = jwt.sign(claims, sa.private_key, { algorithm: "RS256" });
  return `${SAVE_BASE}${token}`;
}

/** Best-effort: keep the wallet pass in sync with the card's stamp count. */
export async function patchLoyaltyPoints(objectId: string, points: number): Promise<void> {
  if (!walletConfigured()) return;
  await walletApi(`/loyaltyObject/${objectId}`, "PATCH", {
    loyaltyPoints: { label: "Tampons", balance: { int: points } },
  });
}

/**
 * Ensures the loyalty class + object exist for a card (creating them on first
 * use and persisting their ids), then returns an "Add to Google Wallet" URL.
 */
export async function createSaveUrlForCard(cardId: string, userId: string): Promise<string> {
  if (!walletConfigured()) throw new WalletNotConfigured();

  const r = await query<CardRow>(
    `SELECT lc.id AS card_id, lc.stamps_count, lc.google_object_id,
            m.id AS merchant_id, m.name AS merchant_name, m.reward_description,
            m.brand_color_bg, m.logo_url, m.google_class_id, m.stamps_required,
            u.full_name, u.id AS user_id
     FROM loyalty_cards lc
     JOIN merchants m ON m.id = lc.merchant_id
     JOIN users u ON u.id = lc.user_id
     WHERE lc.id = $1 AND lc.user_id = $2`,
    [cardId, userId],
  );
  if (r.rowCount === 0) throw new Error("card_not_found");
  const row = r.rows[0];

  const classId = await ensureClass(row);
  if (classId !== row.google_class_id) {
    await query(`UPDATE merchants SET google_class_id = $2 WHERE id = $1`, [row.merchant_id, classId]);
  }

  const objectId = await ensureObject(row, classId);
  if (objectId !== row.google_object_id) {
    await query(`UPDATE loyalty_cards SET google_object_id = $2 WHERE id = $1`, [cardId, objectId]);
  } else {
    // Object already existed — make sure its points reflect the latest count.
    await patchLoyaltyPoints(objectId, row.stamps_count).catch(() => {});
  }

  return buildSaveUrl(objectId);
}
