import { expect, test } from "@playwright/test";
import { accounts } from "../fixtures/accounts";
import { loginViaApi } from "../fixtures/login";

test.describe("merchant — dashboard, config, NFC", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, accounts.merchantFlore);
  });

  test("dashboard shows KPIs and 7-day chart", async ({ page }) => {
    await page.goto("/merchant");
    await expect(page.getByRole("heading", { name: /café flore/i })).toBeVisible();
    await expect(page.getByText("Aujourd'hui")).toBeVisible();
    await expect(page.getByText("Visites")).toBeVisible();
    await expect(page.getByText(/7 derniers jours/i)).toBeVisible();
  });

  test("config page lets us change reward description and persists", async ({ page }) => {
    const newReward = `1 boisson chaude (e2e ${Date.now() % 10000})`;
    await page.goto("/merchant/config");
    await expect(page.getByRole("heading", { name: /votre carte/i })).toBeVisible();

    const rewardInput = page.locator('input').filter({ hasNot: page.locator('[type="range"]') }).nth(1);
    await rewardInput.fill(newReward);

    await page.getByRole("button", { name: /enregistrer/i }).click();
    await expect(page.getByRole("button", { name: /enregistré/i })).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await expect(rewardInput).toHaveValue(newReward);
  });

  test("NFC provisioning creates a new device and lists it", async ({ page }) => {
    await page.goto("/merchant/nfc");
    await expect(page.getByRole("heading", { name: /nfc/i }).first()).toBeVisible();

    await page.getByRole("button", { name: /provisionner/i }).first().click();
    await expect(page.getByText(/nouveau gadget/i)).toBeVisible();

    await page.getByRole("button", { name: /sticker/i }).click();
    const labelInput = page.locator('input[type="text"]').last();
    const label = `E2E ${Date.now() % 10000}`;
    await labelInput.fill(label);

    await page.getByRole("button", { name: /^provisionner$/i }).click();

    await expect(page.getByText(label)).toBeVisible({ timeout: 5_000 });
  });
});
