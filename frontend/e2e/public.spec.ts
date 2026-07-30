import { expect, test } from "@playwright/test";

test("public landing offers Google sign-in and legal controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Know what is safe to spend/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue with Google/i })).toHaveAttribute(
    "href",
    /accounts\/google\/login/,
  );
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
});

test("health endpoint and mobile layout are usable", async ({ page }) => {
  const response = await page.request.get("/health/");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok" });

  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
