import { expect, test } from "@playwright/test";
import { adminCreds, login } from "./helpers";

const creds = adminCreds();

test.describe("admin flow", () => {
  test.skip(!creds, "Set E2E_ADMIN_EMAIL/PASSWORD to run authenticated flows");

  test("can log in and access master management", async ({ page }) => {
    await login(page, creds!);
    await page.goto("/master");
    await expect(page.getByRole("heading", { name: "マスタ管理" })).toBeVisible();
    // The tabs row exposes the five master domains.
    for (const label of ["スタッフ", "部門", "顧客", "現場", "業務内容"]) {
      await expect(page.getByRole("tab", { name: label })).toBeVisible();
    }
  });

  test("reports list page renders for admin", async ({ page }) => {
    await login(page, creds!);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "業務報告" })).toBeVisible();
    // CSV export affordance is admin-only.
    await expect(page.getByRole("button", { name: /CSV出力/ })).toBeVisible();
    // 表示条件 filter card is visible (always rendered before list loads).
    await expect(page.getByText("表示条件")).toBeVisible();
  });

  test("settings is reachable for admin", async ({ page }) => {
    await login(page, creds!);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  });

  test("employee-only routes still load (dashboard, notices)", async ({ page }) => {
    await login(page, creds!);
    await page.goto("/notices");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
