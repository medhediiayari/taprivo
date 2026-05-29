import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("backend health endpoint responds", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("web app boots and shows brand", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Taprivo/);
    await expect(page.getByText("Taprivo", { exact: true }).first()).toBeVisible();
  });

  test("PWA manifest is served with correct name", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.name).toBe("Taprivo");
    expect(manifest.theme_color.toLowerCase()).toBe("#04342c");
  });

  test("unauthenticated user is redirected to /login from /", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("public merchants list is accessible without auth", async ({ request }) => {
    const res = await request.get("/api/merchants");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { merchants: { name: string }[] };
    expect(body.merchants.length).toBeGreaterThan(0);
  });
});
