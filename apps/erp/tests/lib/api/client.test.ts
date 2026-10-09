import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/errors", () => ({
  showErrorToast: vi.fn()
}));

describe("ERP API client auth invalidation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears ERP auth state when a protected request returns Invalid admin token", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Invalid admin token" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/api/client");
    const updates: unknown[] = [];

    client.setAdminAccessToken("access-token");
    client.setAdminAuthUser({
      name: "Staff User",
      email: "staff@capella.test",
      role: "staff",
      permissionKeys: ["orders.read"]
    });
    client.subscribeAdminAuthUser((user) => {
      updates.push(user);
    });

    await expect(client.api.get("/api/erp/orders")).rejects.toThrow("API 401 /api/erp/orders");

    expect(client.getAdminAuthUser()).toBeNull();
    expect(updates.at(-1)).toBeNull();
  });

  it("refreshes and retries ERP requests before invalidating a valid session", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/erp/orders")) {
        const attempt = fetchMock.mock.calls.filter(([url]) => url === input).length;
        if (attempt === 1) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ message: "Invalid admin token" })
          };
        }
        return {
          ok: true,
          json: async () => ({ items: [] })
        };
      }

      return {
        ok: true,
        json: async () => ({
          accessToken: "fresh-admin-token",
          user: {
            name: "Staff User",
            email: "staff@capella.test",
            role: "staff",
            permissionKeys: ["orders.read"]
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/api/client");

    client.setAdminAccessToken("expired-admin-token");
    client.setAdminAuthUser({
      name: "Staff User",
      email: "staff@capella.test",
      role: "staff",
      permissionKeys: ["orders.read"]
    });

    await expect(client.api.get("/api/erp/orders")).resolves.toEqual({ items: [] });
    expect(client.getAdminAuthUser()).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/erp/auth/refresh"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });

  it("sends both upload helpers to the /api/erp/uploads endpoint", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      void input;
      return {
        ok: true,
        status: 200,
        json: async () => ({ url: "/uploads/x.png", path: "x.png", fileName: "x.png" })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/api/client");
    const file = { name: "x.png", type: "image/png", arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;

    await client.api.uploadImage(file, "products.create");
    await client.api.uploadMedia(file, "products.update");

    const uploadCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/erp/uploads"));
    expect(uploadCalls).toHaveLength(2);
  });

  it("refreshes and retries when a protected request returns Admin auth required", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/erp/orders")) {
        const attempt = fetchMock.mock.calls.filter(([url]) => url === input).length;
        if (attempt === 1) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ message: "Admin auth required" })
          };
        }
        return {
          ok: true,
          json: async () => ({ items: [] })
        };
      }

      return {
        ok: true,
        json: async () => ({
          accessToken: "fresh-admin-token",
          user: {
            name: "Admin User",
            email: "admin@capella.test",
            role: "admin",
            permissionKeys: ["orders.read"]
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/api/client");

    await expect(client.api.get("/api/erp/orders")).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/erp/auth/refresh"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});
