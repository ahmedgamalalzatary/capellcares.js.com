import { expect, test, type Page } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

type CatalogItem = { slug: string; media?: Array<unknown>; youtubeUrl?: string | null };

function gallerySize(item: CatalogItem) {
  return (item.media?.length ?? 0) + (item.youtubeUrl ? 1 : 0);
}

async function firstWithGallery(path: string): Promise<CatalogItem> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  const body = await response.json() as { items: CatalogItem[] };
  const match =
    body.items.find((item) => (item.media?.length ?? 0) > 1) ??
    body.items.find((item) => gallerySize(item) > 1) ??
    body.items[0];
  if (!match) {
    throw new Error(`No items at ${path}`);
  }
  return match;
}

async function swipeMain(page: Page, testId: string, fromRatio: number, toRatio: number) {
  const main = page.getByTestId(testId);
  await expect(main).toBeVisible();
  const box = await main.boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  // Mid-image, below the tag/heart overlays, so the gesture hits the gallery.
  const startX = box.x + box.width * fromRatio;
  const endX = box.x + box.width * toRatio;
  const y = box.y + box.height * 0.62;
  await main.evaluate((el, pts) => {
    const fire = (type: string, x: number, y: number, buttons: number) => {
      el.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons
      }));
    };
    fire("pointerdown", pts.startX, pts.y, 1);
    fire("pointermove", pts.endX, pts.y, 1);
    fire("pointerup", pts.endX, pts.y, 0);
  }, { startX, endX, y });
}

async function expectSwipeChangesGallery(page: Page, kind: "product" | "offer" | "collection") {
  const thumbs = page.getByTestId(`${kind}-media-thumbs`).getByRole("button");
  await expect(thumbs.first()).toBeVisible();
  const count = await thumbs.count();
  test.skip(count < 2, `${kind} has only one gallery item in this database`);
  await expect(thumbs.nth(0)).toHaveAttribute("data-active", "true");
  await swipeMain(page, `${kind}-media-main`, 0.85, 0.15);
  await expect(thumbs.nth(1)).toHaveAttribute("data-active", "true");
  await swipeMain(page, `${kind}-media-main`, 0.15, 0.85);
  await expect(thumbs.nth(0)).toHaveAttribute("data-active", "true");
}

test.describe("detail gallery finger swipe (mobile)", () => {
  test("product detail", async ({ page }) => {
    const product = await firstWithGallery("/api/v1/products");
    await page.goto(`/en/products/${product.slug}`);
    await expectSwipeChangesGallery(page, "product");
  });

  test("offer detail", async ({ page }) => {
    const offer = await firstWithGallery("/api/v1/offers");
    await page.goto(`/en/offers/${offer.slug}`);
    await expectSwipeChangesGallery(page, "offer");
  });

  test("collection detail", async ({ page }) => {
    const collection = await firstWithGallery("/api/v1/collections");
    await page.goto(`/en/collections/${collection.slug}`);
    await expectSwipeChangesGallery(page, "collection");
  });
});
