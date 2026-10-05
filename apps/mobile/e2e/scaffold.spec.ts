import { expect, test } from "@playwright/test";

test("boots in Arabic and preserves an English selection after browser reload", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Isolate browser foundation acceptance from API availability. Native/API
  // acceptance still requires real endpoints and is recorded separately.
  await page.route("http://localhost:4000/api/v1/products", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ items: [] })
    })
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "English" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.reload();
  await expect(page.getByRole("button", { name: "العربية" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(pageErrors).toEqual([]);
});
