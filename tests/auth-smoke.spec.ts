import { expect, test } from "@playwright/test";

test("unauthenticated dashboard access redirects to Clerk sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("development crypto proof route is reachable", async ({ page }) => {
  await page.goto("/crypto-proof");
  await expect(page.getByRole("heading", { name: "Argon2id crypto check" })).toBeVisible();
});
