import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { Account } from "./accounts";

/**
 * Performs a full UI login. Lands on the role-appropriate home:
 *   client   → /
 *   merchant → /merchant
 *   admin    → /admin
 */
export async function login(page: Page, account: Account) {
  await page.goto("/login");
  await expect(page.getByText("Taprivo", { exact: true }).first()).toBeVisible();

  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  // Button label has varied across redesigns ("Se connecter", "Entrer") — accept both.
  await page.getByRole("button", { name: /entrer|se connecter/i }).click();

  // Wait until we leave /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 });
}

/**
 * Fast login via API. Two-pronged approach to maximise reliability:
 *
 *  1. `page.goto("/login")` brings the browser to a public route on the right
 *     origin so `localStorage` is accessible and the page won't redirect us
 *     when we set the token.
 *  2. `page.evaluate` sets the token in `localStorage` synchronously.
 *  3. `addInitScript` re-sets the token before every subsequent navigation,
 *     so even if a redirect or reload happens mid-test, the token survives.
 *
 * After this, the test can `page.goto("/admin")` (or any protected route)
 * and AuthProvider sees the token immediately on mount.
 */
export async function loginViaApi(page: Page, account: Account) {
  const res = await page.request.post("/api/auth/login", {
    data: { email: account.email, password: account.password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed for ${account.email}: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };

  // Persist the token across every subsequent navigation.
  await page.addInitScript((t) => {
    window.localStorage.setItem("taprivo_token", t);
  }, body.token);

  // Land on /login (public, no redirect) and set the token concretely.
  await page.goto("/login");
  await page.evaluate((t) => localStorage.setItem("taprivo_token", t), body.token);
}
