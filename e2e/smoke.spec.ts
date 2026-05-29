import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("login page renders with form fields", async ({ page }) => {
    await page.goto("/login");
    // The form mounts after the auth/me check resolves — wait on a stable
    // form field rather than the "ログイン" text (which is shared by the
    // CardTitle and the submit button).
    await expect(page.getByLabel("メールアドレス")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("パスワード")).toBeVisible();
    await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  });

  test("client-side validation blocks empty submit", async ({ page }) => {
    await page.goto("/login");
    // Wait for the form to actually mount before clicking submit.
    await expect(page.getByLabel("メールアドレス")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "ログイン" }).click();
    // zod resolver renders inline errors as <p class="text-destructive">.
    await expect(page.getByText("メールアドレスを入力してください")).toBeVisible();
    await expect(page.getByText("パスワードを入力してください", { exact: true })).toBeVisible();
  });

  test("unauthenticated request to a protected route lands on /login", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("PWA manifest is served with required fields", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThan(0);
  });

  test("service worker script is served", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("CACHE_VERSION");
    expect(body).toContain("addEventListener");
  });

  test("offline fallback page renders", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "オフラインです" })).toBeVisible();
  });
});
