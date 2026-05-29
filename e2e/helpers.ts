import type { Page } from "@playwright/test";

export type Creds = { email: string; password: string };

export function adminCreds(): Creds | null {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function employeeCreds(): Creds | null {
  const email = process.env.E2E_EMPLOYEE_EMAIL;
  const password = process.env.E2E_EMPLOYEE_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

/**
 * Submits the login form and waits for the redirect away from /login.
 * Throws if login fails (caller can wrap in expect/try).
 */
export async function login(page: Page, creds: Creds): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(creds.email);
  await page.getByLabel("パスワード").fill(creds.password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    page.getByRole("button", { name: "ログイン" }).click(),
  ]);
}
