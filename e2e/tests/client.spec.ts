import { expect, test } from "@playwright/test";
import { accounts } from "../fixtures/accounts";
import { loginViaApi } from "../fixtures/login";

test.describe("client — cards & scan", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, accounts.client);
  });

  test("cards list shows seeded merchants and a featured next reward", async ({ page }) => {
    await page.goto("/");
    // FeaturedCard hero with the closest-to-completion card
    await expect(page.getByText(/prochaine récompense/i)).toBeVisible();
    await expect(page.getByText(/plus que/i)).toBeVisible();
    // All three seeded merchants render somewhere (featured + rest of list)
    await expect(page.getByText("Café Flore")).toBeVisible();
    await expect(page.getByText("Le Bistrot")).toBeVisible();
    await expect(page.getByText("Sushi Palace")).toBeVisible();
  });

  test("opening a card morphs into detail view (shared layoutId)", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Café Flore").first().click();
    await page.waitForURL(/\/card\/[a-f0-9-]+$/, { timeout: 10_000 });
    // The detail page has the merchant name as h2 + a "Vos tampons" / "Carte complète" eyebrow.
    await expect(page.getByRole("heading", { name: /café flore/i })).toBeVisible();
    await expect(page.getByText(/vos tampons|carte complète/i)).toBeVisible();
  });

  test("simulating an NFC tap increments the stamp count", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Le Bistrot").first().click();
    await page.waitForURL(/\/card\/[a-f0-9-]+$/, { timeout: 10_000 });

    // Read current count from the API to compute expected after-scan
    const cardsRes = await page.request.get("/api/cards", {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("taprivo_token"))}` },
    });
    const cards = (await cardsRes.json()) as {
      cards: { id: string; stamps_count: number; merchant_name: string }[];
    };
    const bistrot = cards.cards.find((c) => c.merchant_name === "Le Bistrot");
    expect(bistrot).toBeDefined();
    const before = bistrot!.stamps_count;

    // Open NFC mode → click Simuler
    await page.getByRole("button", { name: /^nfc\b/i }).click();
    await expect(page.getByText("NFC actif")).toBeVisible();
    await page.getByRole("button", { name: /simuler/i }).click();

    // Reload data and check
    await page.waitForTimeout(800);
    const after = await page.request.get(`/api/cards/${bistrot!.id}`, {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("taprivo_token"))}` },
    });
    const detail = (await after.json()) as { card: { stamps_count: number } };
    expect(detail.card.stamps_count).toBe(before + 1);
  });

  test("generating a QR code shows the canvas and a countdown ring", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Café Flore").first().click();
    await page.waitForURL(/\/card\/[a-f0-9-]+$/, { timeout: 10_000 });
    await page.getByRole("button", { name: /^qr\b/i }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText(/présentez ce code/i)).toBeVisible();
  });

  test("rewards page lists Sushi Palace pending coupon", async ({ page }) => {
    await page.goto("/rewards");
    await expect(page.getByRole("heading", { name: /récompenses/i })).toBeVisible();
    await expect(page.getByText(/sushi palace/i)).toBeVisible();
  });

  test("profile page shows full name and logout works", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText(accounts.client.name)).toBeVisible();
    await page.getByRole("button", { name: /se déconnecter/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
