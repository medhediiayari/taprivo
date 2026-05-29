import { expect, test } from "@playwright/test";
import { accounts } from "../fixtures/accounts";
import { loginViaApi } from "../fixtures/login";

test.describe("admin — global management", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, accounts.admin);
  });

  test("dashboard shows global KPIs and top merchants", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /vue globale/i })).toBeVisible();
    // KPI labels are exact-match to avoid colliding with the intro paragraph
    // which also contains the substrings "utilisateurs" and "restaurants".
    await expect(page.getByText("Utilisateurs", { exact: true })).toBeVisible();
    await expect(page.getByText("Restaurants", { exact: true })).toBeVisible();
    await expect(page.getByText(/top restaurants/i)).toBeVisible();
  });

  test("restaurants list shows all seeded merchants with metrics", async ({ page }) => {
    await page.goto("/admin/merchants");
    await expect(page.getByRole("heading", { name: /restaurants/i })).toBeVisible();
    await expect(page.getByText("Café Flore")).toBeVisible();
    await expect(page.getByText("Le Bistrot")).toBeVisible();
    await expect(page.getByText("Sushi Palace")).toBeVisible();
  });

  test("suspending a restaurant tags it as suspended and reactivating restores", async ({ page }) => {
    await page.goto("/admin/merchants");
    // Find the article containing "Le Bistrot" and click "Suspendre" inside it
    const card = page.locator("article", { hasText: "Le Bistrot" }).first();
    await card.getByRole("button", { name: /suspendre/i }).click();
    await expect(card.getByText("suspendu")).toBeVisible({ timeout: 5_000 });

    // Reactivate
    await card.getByRole("button", { name: /réactiver/i }).click();
    await expect(card.getByText("suspendu")).toBeHidden({ timeout: 5_000 });
  });

  test("users page filters by role", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: /utilisateurs/i })).toBeVisible();

    // Click "merchant" filter pill
    await page.getByRole("button", { name: /^merchant$/i }).click();
    await page.waitForTimeout(400);

    // Should see the three merchant users
    await expect(page.getByText("flore@demo.com")).toBeVisible();
    await expect(page.getByText("bistrot@demo.com")).toBeVisible();
    await expect(page.getByText("sushi@demo.com")).toBeVisible();
  });

  test("search input filters users by email", async ({ page }) => {
    await page.goto("/admin/users");
    await page.locator('input[placeholder*="echercher"]').fill("karim");
    await page.waitForTimeout(500);
    await expect(page.getByText("karim@demo.com")).toBeVisible();
    await expect(page.getByText("sarah@demo.com")).toBeHidden();
  });

  test("activity page lists recent stamp events", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(page.getByRole("heading", { name: /activité/i })).toBeVisible();
    // Seed produces ~6 events per card × N cards → list should not be empty
    const count = await page.locator("li").count();
    expect(count).toBeGreaterThan(0);
  });

  test("admin cannot self-delete (no delete button on own row)", async ({ page }) => {
    await page.goto("/admin/users");
    const adminRow = page.locator("li", { hasText: accounts.admin.email });
    await expect(adminRow).toBeVisible();
    await expect(adminRow.getByRole("button", { name: /supprimer/i })).toHaveCount(0);
  });
});
