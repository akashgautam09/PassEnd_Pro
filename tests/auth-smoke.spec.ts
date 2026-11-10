import { expect, test } from "@playwright/test";

test("unauthenticated dashboard access redirects to Clerk sign-in", async ({ page }) => {
  await page.goto("/vault");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("development crypto proof route is reachable", async ({ page }) => {
  await page.goto("/crypto-proof");
  await expect(page.getByRole("heading", { name: "Argon2id crypto check" })).toBeVisible();
});

test("ordinary crypto proof rejects wrong passwords and tampering", async ({ page }) => {
  await page.goto("/crypto-proof");
  await page.getByLabel("Temporary test password").fill("phase-10-browser-proof-password");
  await page.getByRole("button", { name: "Run crypto proof" }).click();
  await expect(page.getByText(/Passed: round-trip, wrong-password rejection/)).toBeVisible({ timeout: 30_000 });
  const storageContents = await page.evaluate(() => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage) }));
  expect(storageContents.local).not.toContain("phase-10-browser-proof-password");
  expect(storageContents.session).not.toContain("phase-10-browser-proof-password");
});

test("Recovery Key cryptographic proof rejects wrong keys and tampering", async ({ page }) => {
  page.on("pageerror", (error) => console.log(`Recovery proof page error: ${error.message}`));
  await page.goto("/crypto-proof");
  const recoveryButton = page.getByRole("button", { name: "Test Recovery Key" });
  await expect(recoveryButton).toBeEnabled();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(true))));
  await recoveryButton.click();
  await expect(page.getByText(/Passed: 256-bit Recovery Key round-trip/)).toBeVisible({ timeout: 30_000 });
});
