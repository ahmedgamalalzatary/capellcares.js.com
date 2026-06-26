import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAuthProvider, useAdminAuth } from "@/components/providers/admin-auth";

const KEY = "minikoshk.admin.v1";

describe("AdminAuthProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("hydrates from the canonical session key", async () => {
    const storedUser = {
      name: "Admin User",
      email: "admin@minikoshk.test",
      role: "admin" as const,
      permissionKeys: ["dashboard.read"]
    };

    sessionStorage.setItem(KEY, JSON.stringify(storedUser));

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          accessToken: "token",
          user: storedUser
        })
      }))
    );

    let latestUserEmail = "";
    let latestHydrated = false;

    function Probe() {
      const { user, hydrated } = useAdminAuth();
      latestUserEmail = user?.email ?? "";
      latestHydrated = hydrated;
      return null;
    }

    render(
      <AdminAuthProvider>
        <Probe />
      </AdminAuthProvider>
    );

    await waitFor(() => expect(latestHydrated).toBe(true));
    expect(latestUserEmail).toBe("admin@minikoshk.test");
    expect(sessionStorage.getItem(KEY)).toContain("admin@minikoshk.test");
  });
});
