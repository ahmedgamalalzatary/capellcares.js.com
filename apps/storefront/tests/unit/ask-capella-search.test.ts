import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Language } from "@capella/shared";

import { useAskCapella } from "@/hooks/use-ask-capella";

type Items = {
  products?: unknown[];
  categories?: unknown[];
  offers?: unknown[];
  collections?: unknown[];
};

function stubFetch(items: Items, { fail = false }: { fail?: boolean } = {}) {
  const fetchMock = vi.fn((input: string) => {
    if (fail) {
      return Promise.reject(new TypeError("fetch failed"));
    }
    const url = String(input);
    const key = url.includes("/categories")
      ? "categories"
      : url.includes("/offers")
        ? "offers"
        : url.includes("/collections")
          ? "collections"
          : "products";
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ items: items[key as keyof Items] ?? [] })
    });
  });
  vi.stubGlobal("fetch", fetchMock);
}

// Harness: drives the hook's send() and renders the latest reply's result
// counts so tests can assert what the search produced.
function Harness({ lang, query }: { lang: Language; query: string }) {
  const { messages, send, setInput } = useAskCapella({ lang, onClose: () => {} });
  const reply = [...messages].reverse().find((m) => m.role === "capella");
  return createElement(
    "div",
    null,
    createElement("button", { type: "button", onClick: () => setInput(query) }, "set"),
    createElement("button", { type: "button", onClick: () => send() }, "send"),
    createElement("button", { type: "button", onClick: () => { send(); send(); } }, "send-twice"),
    reply && reply.role === "capella"
      ? createElement(
          "p",
          { "data-testid": "reply" },
          reply.error
            ? "error"
            : `products:${reply.results.products.length}|categories:${reply.results.categories.length}|offers:${reply.results.offers.length}|collections:${reply.results.collections.length}`
        )
      : null
  );
}

async function search(lang: Language, query: string) {
  render(createElement(Harness, { lang, query }));
  fireEvent.click(screen.getByText("set"));
  fireEvent.click(screen.getByText("send"));
  return screen.findByTestId("reply");
}

const cat = (id: number, ar: string, en: string) => ({
  id,
  parentId: null,
  slug: `cat-${id}`,
  name: { ar, en },
  isLeaf: true,
  deletedAt: null
});

const offer = (id: number, ar: string, en: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: `offer-${id}`,
  name: { ar, en },
  price: 100,
  originalTotal: 120,
  status: "active",
  deletedAt: null,
  ...over
});

const collection = (id: number, ar: string, en: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: `collection-${id}`,
  name: { ar, en },
  price: 100,
  originalTotal: 120,
  status: "active",
  visibility: "visible",
  deletedAt: null,
  ...over
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("useAskCapella search", () => {
  it("prevents duplicate submissions while the search request is in flight", () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(Harness, { lang: "en", query: "glow" }));

    fireEvent.click(screen.getByText("set"));
    fireEvent.click(screen.getByText("send-twice"));

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("matches categories and offers by the opposite store language", async () => {
    stubFetch({
      categories: [cat(1, "العناية", "Serum Glow")],
      offers: [offer(1, "الترطيب", "Glow Bundle")]
    });

    // Store is Arabic but the query is an English word present only in enName.
    const reply = await search("ar", "glow");

    expect(reply.textContent).toContain("categories:1");
    expect(reply.textContent).toContain("offers:1");
  });

  it("includes matching active+visible collections and excludes hidden/inactive/deleted", async () => {
    stubFetch({
      collections: [
        collection(1, "مجموعة", "Glow Set"),
        collection(2, "مخفي", "Glow Hidden", { visibility: "hidden" }),
        collection(3, "غير نشط", "Glow Inactive", { status: "inactive" }),
        collection(4, "محذوف", "Glow Deleted", { deletedAt: "2026-01-01" })
      ]
    });

    const reply = await search("en", "glow");

    expect(reply.textContent).toContain("collections:1");
  });

  it("caps counts per section", async () => {
    stubFetch({
      categories: Array.from({ length: 6 }, (_, i) => cat(i + 1, `قسم ${i}`, `Glow Cat ${i}`)),
      offers: Array.from({ length: 6 }, (_, i) => offer(i + 1, `عرض ${i}`, `Glow Offer ${i}`)),
      collections: Array.from({ length: 6 }, (_, i) => collection(i + 1, `مجموعة ${i}`, `Glow Coll ${i}`))
    });

    const reply = await search("en", "glow");

    expect(reply.textContent).toContain("categories:4");
    expect(reply.textContent).toContain("offers:3");
    expect(reply.textContent).toContain("collections:3");
  });

  it("surfaces an error (not empty results) when the API connection fails", async () => {
    stubFetch({}, { fail: true });

    const reply = await search("en", "glow");

    expect(reply.textContent).toBe("error");
  });
});
