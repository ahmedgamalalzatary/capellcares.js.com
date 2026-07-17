import { afterEach, describe, expect, it, vi } from "vitest";
import { isWishlisted, readWishlist, syncWishlist, toggleWishlist } from "@/lib/wishlist";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * Each test that syncs uses a distinct user id: `syncWishlist` memoizes per
 * user per page load (module state persists across tests in this file).
 */
function logIn(userId = 1) {
  localStorage.setItem(
    "minikoshk_auth",
    JSON.stringify({ accessToken: "token-1", user: { id: userId, name: "Ahmed", email: "a@example.com" } })
  );
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("wishlist storage", () => {
  it("toggles product ids on and off", () => {
    expect(toggleWishlist(5)).toEqual([5]);
    expect(isWishlisted(5)).toBe(true);
    expect(toggleWishlist(9)).toEqual([5, 9]);
    expect(toggleWishlist(5)).toEqual([9]);
    expect(isWishlisted(5)).toBe(false);
  });

  it("drops malformed stored entries and duplicates", () => {
    localStorage.setItem("minikoshk_wishlist", JSON.stringify([3, "4", null, 3, -1, 7]));
    expect(readWishlist()).toEqual([3, 7]);
  });

  it("does not call the API for guests", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    toggleWishlist(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mirrors adds and removes to the API when logged in", async () => {
    logIn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    toggleWishlist(2);
    toggleWishlist(2);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [addUrl, addInit] = fetchMock.mock.calls[0];
    expect(String(addUrl)).toContain("/api/v1/wishlist");
    expect(addInit.method).toBe("POST");
    expect(addInit.headers.Authorization).toBe("Bearer token-1");
    expect(JSON.parse(addInit.body)).toEqual({ productId: 2 });

    const [removeUrl, removeInit] = fetchMock.mock.calls[1];
    expect(String(removeUrl)).toContain("/api/v1/wishlist/2");
    expect(removeInit.method).toBe("DELETE");
  });

  it("merges the server wishlist with local ids on sync", async () => {
    logIn(10);
    localStorage.setItem("minikoshk_wishlist", JSON.stringify([7]));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      items: [{ id: 1, customerId: 1, productId: 3 }]
    }));
    vi.stubGlobal("fetch", fetchMock);

    const merged = await syncWishlist();

    expect(merged.sort()).toEqual([3, 7]);
    expect(readWishlist().sort()).toEqual([3, 7]);
    // The local-only id (7) gets pushed up to the server.
    await vi.waitFor(() => {
      const pushed = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(pushed).toBeTruthy();
      expect(JSON.parse(pushed![1].body)).toEqual({ productId: 7 });
    });
  });

  it("shares one request across concurrent syncs and memoizes per user", async () => {
    logIn(11);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([syncWishlist(), syncWishlist(), syncWishlist()]);
    await syncWishlist();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not resurrect a product removed while a sync is in flight", async () => {
    logIn(12);
    localStorage.setItem("minikoshk_wishlist", JSON.stringify([3]));

    let releaseServerList: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseServerList = resolve;
    });
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return gate.then(() => jsonResponse({ items: [{ id: 1, customerId: 12, productId: 3 }] }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const sync = syncWishlist();
    toggleWishlist(3); // remove while the server list is still in flight
    releaseServerList!();
    const merged = await sync;

    expect(merged).toEqual([]);
    expect(readWishlist()).toEqual([]);
  });

  it("discards a sync completion after the auth session changes", async () => {
    logIn(20);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => gate.then(() => jsonResponse({ items: [{ productId: 8 }] }))));

    const staleSync = syncWishlist();
    localStorage.setItem("minikoshk_auth", JSON.stringify({ accessToken: "token-2", user: { id: 21, name: "Other", email: "o@example.com" } }));
    localStorage.setItem("minikoshk_wishlist", JSON.stringify([9]));
    release();

    expect(await staleSync).toEqual([9]);
    expect(readWishlist()).toEqual([9]);
  });

  it("synchronizes the same account again after logout and login", async () => {
    logIn(30);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await syncWishlist();

    localStorage.removeItem("minikoshk_auth");
    await syncWishlist();
    localStorage.setItem("minikoshk_auth", JSON.stringify({ accessToken: "new-token", user: { id: 30, name: "Ahmed", email: "a@example.com" } }));
    await syncWishlist();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not merge the previous account's wishlist into a different account", async () => {
    logIn(40);
    localStorage.setItem("minikoshk_wishlist", JSON.stringify([4]));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ productId: 4 }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ productId: 5 }] }));
    vi.stubGlobal("fetch", fetchMock);
    await syncWishlist();

    localStorage.setItem("minikoshk_auth", JSON.stringify({ accessToken: "token-2", user: { id: 41, name: "Other", email: "o@example.com" } }));
    const merged = await syncWishlist();

    expect(merged).toEqual([5]);
    expect(readWishlist()).toEqual([5]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("leaves the local wishlist untouched for guests on sync", async () => {
    localStorage.setItem("minikoshk_wishlist", JSON.stringify([4]));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await syncWishlist()).toEqual([4]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
