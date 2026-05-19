import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/providers/auth-provider";

function Probe() {
  const { user, accessToken } = useAuth();
  return createElement("div", null, `${user?.email ?? "none"}|${accessToken ?? "no-token"}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("AuthProvider", () => {
  it("refreshes the access token on hydration when user data exists in storage", async () => {
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "fresh-token" })
    }));

    render(createElement(AuthProvider, null, createElement(Probe)));

    await waitFor(() => expect(screen.getByText("user@capella.test|fresh-token")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/refresh"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});
