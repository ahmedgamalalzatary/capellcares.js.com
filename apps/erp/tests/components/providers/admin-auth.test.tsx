import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/errors", () => ({
  showErrorToast: vi.fn()
}));

describe("AdminAuthProvider session refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shares one in-flight refresh with a concurrent 401 and keeps the user signed in", async () => {
    let resolveRefresh: (value: unknown) => void = () => {};
    const refreshResponse = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    const user = { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["orders.read"] };

    const fetchMock = vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/erp/auth/refresh")) {
        return refreshResponse;
      }
      if (url.endsWith("/api/erp/orders")) {
        const attempt = fetchMock.mock.calls.filter(([candidate]) => String(candidate).endsWith("/api/erp/orders")).length;
        if (attempt === 1) {
          return Promise.resolve({ ok: false, status: 401, json: async () => ({ message: "Invalid admin token" }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/lib/api/client");
    const { AdminAuthProvider } = await import("@/components/providers/admin-auth");

    render(<AdminAuthProvider><div /></AdminAuthProvider>);

    const refreshCalls = () => fetchMock.mock.calls.filter(([candidate]) => String(candidate).includes("/api/erp/auth/refresh"));
    await waitFor(() => {
      expect(refreshCalls()).toHaveLength(1);
    });

    // A protected request hits a 401 while the provider's refresh is still in flight.
    const pending = client.api.get("/api/erp/orders");
    resolveRefresh({ ok: true, json: async () => ({ accessToken: "fresh-admin-token", user }) });

    await expect(pending).resolves.toEqual({ items: [] });

    expect(refreshCalls()).toHaveLength(1);
    expect(client.getAdminAuthUser()).toEqual(user);
  });
});
