import { expect, test } from "@playwright/test";

const baseUrl = process.env.STAGING_BASE_URL;
const apiBaseUrl = process.env.STAGING_API_BASE_URL;
const productSlug = process.env.STAGING_PRODUCT_SLUG;
const outOfStockProductSlug = process.env.STAGING_OUT_OF_STOCK_PRODUCT_SLUG;
const outOfStockOfferSlug = process.env.STAGING_OUT_OF_STOCK_OFFER_SLUG;
const existingCustomerEmail = process.env.STAGING_EXISTING_CUSTOMER_EMAIL;
const existingCustomerPhone = process.env.STAGING_EXISTING_CUSTOMER_PHONE ?? "01012345678";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  test.skip(!baseUrl, "STAGING_BASE_URL is required for staging smoke.");
});

test("guest wishlist warning and login redirect link", async ({ page }) => {
  test.skip(!productSlug, "STAGING_PRODUCT_SLUG is required.");

  await page.goto(`/en/products/${productSlug}`);
  await page.getByRole("button", { name: /add to wishlist/i }).click();

  await expect(page.getByText(/please log in first/i)).toBeVisible();
  await expect(page.getByText(/log in/i)).toBeVisible();
});

test("active language path and x-lang behavior", async ({ page, request }) => {
  test.skip(!apiBaseUrl, "STAGING_API_BASE_URL is required.");

  const englishResponse = await request.get(`${apiBaseUrl}/api/v1/categories`, {
    headers: { "x-lang": "en" }
  });
  const arabicResponse = await request.get(`${apiBaseUrl}/api/v1/categories`, {
    headers: { "x-lang": "ar" }
  });

  expect(englishResponse.ok()).toBeTruthy();
  expect(arabicResponse.ok()).toBeTruthy();

  const englishPayload = await englishResponse.json();
  const arabicPayload = await arabicResponse.json();
  const englishCategory = englishPayload.items?.[0];
  const arabicCategory = arabicPayload.items?.[0];

  expect(englishCategory).toBeTruthy();
  expect(arabicCategory).toBeTruthy();
  expect(englishCategory.name?.en ?? englishCategory.enName).toBeTruthy();
  expect(arabicCategory.name?.ar ?? arabicCategory.arName).toBeTruthy();
  expect(englishCategory.name?.en ?? englishCategory.enName).not.toBe(
    arabicCategory.name?.ar ?? arabicCategory.arName
  );

  await page.goto("/en/products");
  await expect(page).toHaveURL(/\/en\/products/);
  await expect(page.getByRole("heading", { name: /care that fits your ritual\./i })).toBeVisible();
});

test("out-of-stock variant blocks add-to-cart", async ({ page }) => {
  test.skip(!outOfStockProductSlug, "STAGING_OUT_OF_STOCK_PRODUCT_SLUG is required.");

  await page.goto(`/en/products/${outOfStockProductSlug}`);
  await expect(page.getByRole("button", { name: /add to cart/i })).toBeDisabled();
});

test("visible out-of-stock offer blocks purchase", async ({ page }) => {
  test.skip(!outOfStockOfferSlug, "STAGING_OUT_OF_STOCK_OFFER_SLUG is required.");

  await page.goto(`/en/offers/${outOfStockOfferSlug}`);
  await expect(page.getByRole("button", { name: /add bundle/i })).toBeDisabled();
  await expect(page.getByText(/currently unavailable/i)).toBeVisible();
});

test("guest checkout works when the email already exists", async ({ page }) => {
  test.skip(!productSlug || !existingCustomerEmail, "Checkout smoke env vars are required.");

  await page.goto(`/en/products/${productSlug}`);
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.goto("/en/checkout");

  await page.getByPlaceholder("01XXXXXXXXX").fill(existingCustomerPhone);
  await page.locator("input[type='email']").fill(existingCustomerEmail);
  await page.locator("input").nth(0).fill("Smoke Guest");
  await page.locator("select").selectOption("Cairo");
  await page.locator("input").nth(3).fill("Nasr City");
  await page.locator("input").nth(4).fill("Street 10");
  await page.locator("input").nth(5).fill("Building 2");
  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page.getByText(/order placed/i)).toBeVisible();
});

test("COD order starts as pending", async ({ request }) => {
  test.skip(!apiBaseUrl || !existingCustomerEmail || !productSlug, "COD smoke env vars are required.");

  const productsResponse = await request.get(`${apiBaseUrl}/api/v1/products`);
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = (productsPayload.items ?? []).find((item: { slug?: string }) => item.slug === productSlug);
  const variantId = product?.variants?.[0]?.id;
  test.skip(!variantId, "STAGING_PRODUCT_SLUG must resolve to a product with at least one variant.");

  const response = await request.post(`${apiBaseUrl}/api/v1/checkout`, {
    data: {
      fullName: "Smoke COD",
      phone: existingCustomerPhone,
      email: existingCustomerEmail,
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      buildingApartment: "Building 2",
      paymentMethod: "cod",
      items: [{ type: "product", variantId, qty: 1 }]
    }
  });

  expect(response.status()).toBe(201);
  await expect(response.json()).resolves.toMatchObject({ paymentStatus: "pending" });
});

test("cart persists after refresh", async ({ page }) => {
  test.skip(!productSlug, "STAGING_PRODUCT_SLUG is required.");

  await page.goto(`/en/products/${productSlug}`);
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.goto("/en/cart");
  await expect(page.getByRole("table")).toBeVisible();
  const beforeRefresh = await page.evaluate(() => window.localStorage.getItem("capella.cart.v1"));
  expect(beforeRefresh).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  const afterRefresh = await page.evaluate(() => window.localStorage.getItem("capella.cart.v1"));
  expect(afterRefresh).toBe(beforeRefresh);
});
