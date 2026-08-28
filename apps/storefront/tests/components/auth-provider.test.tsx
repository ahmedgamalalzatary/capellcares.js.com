import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/providers/auth-provider";

function Probe() {
  const { user, accessToken } = useAuth();
  return createElement("div", null, `${user?.email ?? "none"}|${accessToken ?? "no-token"}`);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

function ErrorProbe() {
  const { user, accessToken } = useAuth();
  return createElement("div", null, `${user?.email ?? "none"}|${accessToken ?? "no-token"}`);
}

let controlledAuth: ReturnType<typeof useAuth> | null = null;
function ControlledProbe() {
  controlledAuth = useAuth();
  return createElement("div", null, `${controlledAuth.user?.email ?? "none"}|${controlledAuth.accessToken ?? "no-token"}`);
}

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

  it("clears session when refresh returns 401", async () => {
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    }));

    render(createElement(AuthProvider, null, createElement(ErrorProbe)));

    await waitFor(() => expect(screen.getByText("none|no-token")).toBeInTheDocument());
  });

  it("clears session when refresh returns 403", async () => {
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403
    }));

    render(createElement(AuthProvider, null, createElement(ErrorProbe)));

    await waitFor(() => expect(screen.getByText("none|no-token")).toBeInTheDocument());
  });

  it("preserves session when refresh returns non-auth error (500)", async () => {
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    }));

    render(createElement(AuthProvider, null, createElement(ErrorProbe)));

    await waitFor(() => expect(screen.getByText("user@capella.test|no-token")).toBeInTheDocument());
  });

  it("preserves session when refresh fails with network error", async () => {
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));

    render(createElement(AuthProvider, null, createElement(ErrorProbe)));

    await waitFor(() => expect(screen.getByText("user@capella.test|no-token")).toBeInTheDocument());
  });

  it("reschedules proactive refresh after a transient failure", async () => {
    vi.useFakeTimers();
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));
    const expiresSoon = Math.floor(Date.now() / 1000) + 61;
    const token = `header.${btoa(JSON.stringify({ exp: expiresSoon }))}.signature`;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: token }) })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: "replacement-token" }) }));

    render(createElement(AuthProvider, null, createElement(Probe)));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByText("user@capella.test|replacement-token")).toBeInTheDocument();
  });

  it("shares one in-flight refresh between bootstrap and other callers", async () => {
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));
    let releaseRefresh!: (response: unknown) => void;
    const refreshResponse = new Promise((resolve) => {
      releaseRefresh = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(refreshResponse));
    const authApi = await import("@/lib/auth-provider.api");

    render(createElement(AuthProvider, null, createElement(Probe)));
    await act(async () => { await Promise.resolve(); });
    const concurrent = authApi.refreshAccessTokenOrNull();

    releaseRefresh({ ok: true, status: 200, json: async () => ({ accessToken: "shared-token" }) });
    await act(async () => { await concurrent; });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("user@capella.test|shared-token")).toBeInTheDocument();
  });

  it("does not schedule another refresh after unmounting during an in-flight attempt", async () => {
    vi.useFakeTimers();
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));
    const expiresSoon = Math.floor(Date.now() / 1000) + 61;
    const token = `header.${btoa(JSON.stringify({ exp: expiresSoon }))}.signature`;
    let releaseRetry!: (response: unknown) => void;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: token }) })
      .mockImplementationOnce(() => new Promise((resolve) => { releaseRetry = resolve; })));

    const view = render(createElement(AuthProvider, null, createElement(Probe)));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    view.unmount();
    releaseRetry({ ok: false, status: 500 });
    await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(30_000); });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("recovers bootstrap after a transient refresh failure", async () => {
    vi.useFakeTimers();
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Capella User", email: "user@capella.test" }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: "recovered-token" }) }));

    render(createElement(AuthProvider, null, createElement(Probe)));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("user@capella.test|recovered-token")).toBeInTheDocument();
  });

  it("does not clear a newly logged-in customer when an older bootstrap refresh finishes", async () => {
    localStorage.setItem("capella.auth.v1", JSON.stringify({ id: 1, name: "Customer A", email: "a@capella.test" }));
    let releaseBootstrap!: (response: unknown) => void;
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { releaseBootstrap = resolve; }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: "customer-b-token",
          user: { id: 2, name: "Customer B", email: "b@capella.test" }
        })
      }));

    render(createElement(AuthProvider, null, createElement(ControlledProbe)));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await controlledAuth!.login("b@capella.test", "password"); });
    releaseBootstrap({ ok: false, status: 500 });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText("b@capella.test|customer-b-token")).toBeInTheDocument();
  });
});
