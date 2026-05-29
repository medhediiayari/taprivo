import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { tx } from "./db.js";

export const seedIfEmpty = async () => {
  await tx(async (c) => {
    const userCount = await c.query<{ n: string }>(`SELECT count(*)::text AS n FROM users`);
    if (Number(userCount.rows[0].n) > 0) {
      console.log("[seed] users already present, skipping");
      return;
    }
    console.log("[seed] seeding demo data...");

    const hash = await bcrypt.hash("demo1234", 10);

    const insertUser = async (
      full_name: string,
      email: string,
      role: "client" | "merchant" | "admin",
    ) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [full_name, email, hash, role],
      );
      return r.rows[0].id;
    };

    await insertUser("Admin Taprivo", "admin@demo.com", "admin");
    const karim = await insertUser("Karim Ben Salah", "karim@demo.com", "client");
    const sarah = await insertUser("Sarah Mansouri", "sarah@demo.com", "client");
    const floreOwner = await insertUser("Café Flore", "flore@demo.com", "merchant");
    const bistrotOwner = await insertUser("Le Bistrot", "bistrot@demo.com", "merchant");
    const sushiOwner = await insertUser("Sushi Palace", "sushi@demo.com", "merchant");

    const insertMerchant = async (params: {
      owner: string;
      name: string;
      slug: string;
      address: string;
      lat: number;
      lng: number;
      reward: string;
      accent: string;
      logo: string;
    }) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO merchants
         (owner_user_id, name, slug, address, lat, lng, nfc_secret_key, reward_description, brand_accent, logo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          params.owner,
          params.name,
          params.slug,
          params.address,
          params.lat,
          params.lng,
          randomBytes(32).toString("hex"),
          params.reward,
          params.accent,
          params.logo,
        ],
      );
      return r.rows[0].id;
    };

    // Hero photos: picsum.photos avec seeds descriptifs.
    // En prod, remplacer par les vraies photos des restos uploadées.
    const flore = await insertMerchant({
      owner: floreOwner,
      name: "Café Flore",
      slug: "cafe-flore",
      address: "12 rue de la Paix, Tunis",
      lat: 36.8065,
      lng: 10.1815,
      reward: "1 café offert",
      accent: "#D85A30",
      logo: "https://picsum.photos/seed/cafe-flore-tunis-espresso-warm/1200/900",
    });
    const bistrot = await insertMerchant({
      owner: bistrotOwner,
      name: "Le Bistrot",
      slug: "le-bistrot",
      address: "Avenue Habib Bourguiba, Tunis",
      lat: 36.8003,
      lng: 10.1843,
      reward: "1 plat offert",
      accent: "#0F6E56",
      logo: "https://picsum.photos/seed/le-bistrot-tunis-mediterranean-table-rustic/1200/900",
    });
    const sushi = await insertMerchant({
      owner: sushiOwner,
      name: "Sushi Palace",
      slug: "sushi-palace",
      address: "Les Berges du Lac, Tunis",
      lat: 36.8425,
      lng: 10.232,
      reward: "1 menu offert",
      accent: "#04342C",
      logo: "https://picsum.photos/seed/sushi-palace-counter-minimal-dark/1200/900",
    });

    const insertDevice = async (merchantId: string, type: string, label: string) => {
      await c.query(
        `INSERT INTO nfc_devices (merchant_id, uid, device_type, label) VALUES ($1, $2, $3, $4)`,
        [merchantId, randomBytes(6).toString("hex").toUpperCase(), type, label],
      );
    };
    await insertDevice(flore, "totem", "Totem caisse");
    await insertDevice(flore, "sticker", "Sticker comptoir");
    await insertDevice(bistrot, "bracelet", "Bracelet serveur");
    await insertDevice(sushi, "totem", "Totem entrée");

    const insertCard = async (userId: string, merchantId: string, stamps: number) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO loyalty_cards (user_id, merchant_id, stamps_count, total_stamps_earned, last_visit_at)
         VALUES ($1, $2, $3, $3, now() - (random() * interval '5 days'))
         RETURNING id`,
        [userId, merchantId, stamps],
      );
      return r.rows[0].id;
    };

    await insertCard(karim, flore, 7);
    await insertCard(karim, bistrot, 3);
    const sushiCard = await insertCard(karim, sushi, 0);

    await c.query(
      `INSERT INTO rewards (card_id, user_id, merchant_id, coupon_code, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '30 days')`,
      [sushiCard, karim, sushi, randomBytes(6).toString("hex").toUpperCase()],
    );

    await insertCard(sarah, flore, 5);
    await insertCard(sarah, sushi, 9);

    const seedStamps = async (cardId: string, merchantId: string, userId: string, n: number) => {
      for (let i = 0; i < n; i++) {
        await c.query(
          `INSERT INTO stamp_events (card_id, merchant_id, user_id, method, geo_verified, scanned_at)
           VALUES ($1, $2, $3, $4, true, now() - (random() * interval '7 days'))`,
          [cardId, merchantId, userId, i % 3 === 0 ? "qr" : "nfc"],
        );
      }
    };

    const allCards = await c.query<{ id: string; merchant_id: string; user_id: string }>(
      `SELECT id, merchant_id, user_id FROM loyalty_cards`,
    );
    for (const card of allCards.rows) {
      await seedStamps(card.id, card.merchant_id, card.user_id, 6);
    }

    console.log("[seed] demo data ready");
  });
};
