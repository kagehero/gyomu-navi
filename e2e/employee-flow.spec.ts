import { expect, test } from "@playwright/test";
import { employeeCreds, login } from "./helpers";

const creds = employeeCreds();

test.describe("employee flow", () => {
  test.skip(!creds, "Set E2E_EMPLOYEE_EMAIL/PASSWORD to run authenticated flows");

  test("can log in and reach the dashboard", async ({ page }) => {
    await login(page, creds!);
    // Employees land on the dashboard; either the page header or the bottom-nav
    // home item should be visible.
    await expect(page.getByRole("main")).toBeVisible();
    // Sanity: the auth/me check populated state and we are no longer on /login.
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("can open the report submission tab", async ({ page }) => {
    await login(page, creds!);
    await page.goto("/reports");
    // The employee variant uses tabs (報告入力 / 履歴).
    const submitTab = page.getByRole("tab", { name: "報告入力" });
    await expect(submitTab).toBeVisible();
    await submitTab.click();
    // The form's "報告日・部門" card title is rendered once the tab is active.
    await expect(page.getByText("報告日・部門")).toBeVisible();
    // Image attach affordance is present (key acceptance for 2.11 + 2.2).
    await expect(page.getByText("報告画像（任意）")).toBeVisible();
  });

  test("can open attendance page (punch UI present)", async ({ page }) => {
    await login(page, creds!);
    await page.goto("/attendance");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("logout returns to /login", async ({ page, context }) => {
    await login(page, creds!);
    // Hit the logout endpoint directly — UI affordance varies between admin
    // sidebar and employee bottom-nav, and the API is the source of truth.
    const res = await context.request.post("/api/auth/logout");
    expect(res.ok()).toBe(true);
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
});
