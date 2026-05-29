import { expect, test } from "@playwright/test";
import { accounts } from "../fixtures/accounts";
import { login } from "../fixtures/login";

test.describe("auth", () => {
  test("client logs in and lands on cards page", async ({ page }) => {
    await login(page, accounts.client);
    await expect(page).toHaveURL(/\/$/);
    // Cards page redesign: "Bonjour," is now a small <p>, the H1 is the user's first name,
    // and the FeaturedCard hero shows "Prochaine récompense".
    await expect(page.getByText(/bonjour/i)).toBeVisible();
    await expect(page.getByText(accounts.client.name.split(" ")[0])).toBeVisible();
  });

  test("merchant logs in and lands on dashboard", async ({ page }) => {
    await login(page, accounts.merchantFlore);
    await expect(page).toHaveURL(/\/merchant$/);
    await expect(page.getByText("Tableau de bord")).toBeVisible();
    await expect(page.getByRole("heading", { name: /café flore/i })).toBeVisible();
  });

  test("admin logs in and lands on admin dashboard", async ({ page }) => {
    await login(page, accounts.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Administration")).toBeVisible();
    await expect(page.getByRole("heading", { name: /vue globale/i })).toBeVisible();
  });

  test("wrong password shows error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(accounts.client.email);
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.getByRole("button", { name: /entrer|se connecter/i }).click();
    await expect(page.getByText(/incorrects/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("client cannot access /merchant — redirected back to /", async ({ page }) => {
    await login(page, accounts.client);
    await page.goto("/merchant");
    await expect(page).toHaveURL(/\/$/);
  });

  test("merchant cannot access /admin — redirected to /merchant", async ({ page }) => {
    await login(page, accounts.merchantFlore);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/merchant$/);
  });

  test("signup creates a new client account and lands on cards", async ({ page }) => {
    const unique = `e2e-${Date.now()}@demo.test`;
    await page.goto("/signup");
    await page.locator('input').nth(0).fill("E2E Tester");
    await page.locator('input[type="email"]').fill(unique);
    await page.locator('input[type="password"]').fill("e2e-strong-pwd");
    await page.getByRole("button", { name: /créer le compte/i }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });
});
