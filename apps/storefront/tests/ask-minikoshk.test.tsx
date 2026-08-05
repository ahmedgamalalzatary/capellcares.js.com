import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import LangLayout from "@/app/[lang]/layout";

const emptyResults = { products: [], categories: [], offers: [], collections: [] };

function jsonResponse(body: unknown, ok = true): Promise<Response> {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Server Error",
    json: async () => body
  } as Response);
}

async function renderLayout(lang: "ar" | "en" = "en") {
  render(await LangLayout({ children: <main>Store content</main>, params: Promise.resolve({ lang }) }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Ask Minikoshk", () => {
  it("opens a localized, dismissible search drawer from the floating button", async () => {
    await renderLayout("en");

    fireEvent.click(screen.getByRole("button", { name: "Ask Minikoshk" }));

    expect(screen.getByRole("dialog", { name: "Your shopping assistant" })).toBeInTheDocument();
    expect(screen.getByText(/tell me what you are looking for/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask Minikoshk" })).toHaveFocus());
  });

  it("submits one encoded query and renders linked results from every group", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse({
      products: [{
        id: 1,
        slug: "body-lotion",
        name: { ar: "لوشن الجسم", en: "Body Lotion" },
        keywords: [],
        imagePath: "/lotion.png",
        media: [],
        status: "active",
        isNew: false,
        isBestseller: false,
        sizes: [],
        colors: [],
        variants: [{ id: 1, sizeId: 1, colorId: null, price: 350, stock: 2 }]
      }],
      categories: [{
        id: 2,
        parentId: null,
        slug: "body-care",
        name: { ar: "العناية بالجسم", en: "Body Care" },
        imagePath: null,
        isLeaf: false,
        deletedAt: null
      }],
      offers: [{ id: 3, slug: "body-offer", name: { ar: "عرض الجسم", en: "Body Offer" }, description: { ar: "", en: "" }, imagePath: "", price: 600, originalTotal: 700, stock: 2, status: "active", items: [] }],
      collections: [{ id: 4, slug: "body-set", name: { ar: "مجموعة الجسم", en: "Body Set" }, description: { ar: "", en: "" }, imagePath: "", price: 800, originalTotal: 900, stock: 2, status: "active", visibility: "visible", categoryId: 2, items: [] }]
    }));
    await renderLayout("en");
    fireEvent.click(screen.getByRole("button", { name: "Ask Minikoshk" }));
    const input = screen.getByPlaceholderText("Type a message…");

    fireEvent.change(input, { target: { value: "body & care" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByRole("link", { name: /body lotion/i })).toHaveAttribute("href", "/en/products/body-lotion");
    expect(screen.getByRole("link", { name: "Body Care" })).toHaveAttribute("href", "/en/shop?category=body-care");
    expect(screen.getByRole("link", { name: /body offer/i })).toHaveAttribute("href", "/en/offers/body-offer");
    expect(screen.getByRole("link", { name: /body set/i })).toHaveAttribute("href", "/en/collections/body-set");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/search?q=body+%26+care");
  });

  it("keeps one request in flight and restores the input after the answer", async () => {
    let resolveSearch!: (value: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => {
      resolveSearch = resolve;
    }));
    await renderLayout("en");
    fireEvent.click(screen.getByRole("button", { name: "Ask Minikoshk" }));
    const input = screen.getByPlaceholderText("Type a message…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "body" } });
    fireEvent.submit(input.closest("form")!);

    expect(input).toBeDisabled();
    expect(screen.getByRole("status", { name: "Searching" })).toBeInTheDocument();
    fireEvent.submit(input.closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveSearch(await jsonResponse(emptyResults));
    await waitFor(() => expect(input).not.toBeDisabled());
  });

  it("distinguishes an empty result from a temporary API error", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => jsonResponse(emptyResults))
      .mockImplementationOnce(() => jsonResponse({ message: "broken" }, false));
    await renderLayout("en");
    fireEvent.click(screen.getByRole("button", { name: "Ask Minikoshk" }));
    const input = screen.getByPlaceholderText("Type a message…");

    fireEvent.change(input, { target: { value: "nothing" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText(/couldn.t find anything for “nothing”/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "retry" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Temporary error. Please try again.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
