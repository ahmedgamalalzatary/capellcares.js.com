import { afterEach, describe, expect, it, vi } from "vitest";
import { apiSendAuthed } from "@/lib/auth";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("apiSendAuthed", () => {
  it("refreshes an expired access token and retries the request once", async () => {
    localStorage.setItem(
      "minikoshk_auth",
      JSON.stringify({ accessToken: "stale-token", user: { id: 1, name: "Ahmed", email: "a@example.com" } })
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-token" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSendAuthed<{ ok: boolean }>("/wishlist", { body: { productId: 1 } });

    expect(result).toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer fresh-token");
    // The rotated token is persisted for subsequent calls.
    expect(JSON.parse(localStorage.getItem("minikoshk_auth")!)).toMatchObject({ accessToken: "fresh-token" });
  });

  it("retries unauthenticated when the refresh itself fails (guest-capable flows survive)", async () => {
    localStorage.setItem(
      "minikoshk_auth",
      JSON.stringify({ accessToken: "stale-token", user: { id: 1, name: "Ahmed", email: "a@example.com" } })
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: "Invalid refresh token" }, 401))
      .mockResolvedValueOnce(jsonResponse({ orderCode: "ORD-1" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiSendAuthed<{ orderCode: string }>("/checkout", { body: {} });

    expect(result).toEqual({ orderCode: "ORD-1" });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBeUndefined();
    // The dead session was cleared.
    expect(localStorage.getItem("minikoshk_auth")).toBeNull();
  });

  it("sends without a token for guests and does not attempt a refresh on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiSendAuthed("/wishlist", { method: "GET" })).rejects.toThrow("Unauthorized");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves auth and propagates transient refresh failures", async () => {
    const stored = { accessToken: "stale-token", user: { id: 1, name: "Ahmed", email: "a@example.com" } };
    localStorage.setItem("minikoshk_auth", JSON.stringify(stored));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: "Unavailable" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiSendAuthed("/wishlist", { method: "GET" })).rejects.toThrow("Unavailable");
    expect(JSON.parse(localStorage.getItem("minikoshk_auth")!)).toEqual(stored);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
