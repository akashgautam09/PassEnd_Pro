import { expect, test } from "@playwright/test";

const email = process.env.E2E_CLERK_EMAIL;
const password = process.env.E2E_CLERK_PASSWORD;

test.describe("authenticated vault boundary", () => {
  test.skip(!email || !password, "Set E2E_CLERK_EMAIL and E2E_CLERK_PASSWORD locally to run authenticated tests.");

  test("signed-in account reaches the client-side vault gate", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email address").fill(email!);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole("button", { name: /continue|sign in/i }).click();

    await expect(page).toHaveURL(/http:\/\/127\.0\.0\.1:3000\/?(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: /create your master password|unlock your vault/i })).toBeVisible({ timeout: 30_000 });
  });
});
