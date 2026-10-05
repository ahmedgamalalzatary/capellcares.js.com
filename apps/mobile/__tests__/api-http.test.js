jest.mock("../src/lib/api/base", () => ({
  API_BASE: "https://api.example.com"
}));

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(body == null ? "" : JSON.stringify(body))
  };
}

function emptyResponse(status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input")),
    text: jest.fn().mockResolvedValue("")
  };
}

describe("mobile API HTTP transport", () => {
  let http;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    http = require("../src/lib/api/http");
    http.configureAuthSessionAdapter(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
  });

  test("aborts a stalled request after the shared timeout", async () => {
    jest.useFakeTimers();
    global.fetch.mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    );

    const pending = http.getJSON("/slow", { throwOnError: true });
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await jest.advanceTimersByTimeAsync(15_000);

    await rejection;
    expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  test("keeps the timeout active while a successful response body stalls", async () => {
    jest.useFakeTimers();
    let requestSignal;
    global.fetch.mockImplementation((_url, init) => {
      requestSignal = init.signal;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: jest.fn(),
        text: () =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              const error = new Error("aborted body");
              error.name = "AbortError";
              reject(error);
            });
          })
      });
    });

    const pending = http.getJSON("/slow-body", { throwOnError: true });
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(15_000);

    expect(requestSignal.aborted).toBe(true);
    await rejection;
  });

  test("returns null when an optional public read times out", async () => {
    jest.useFakeTimers();
    global.fetch.mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    );

    const pending = http.getJSON("/slow");
    const resolution = expect(pending).resolves.toBeNull();
    await jest.advanceTimersByTimeAsync(15_000);

    await resolution;
  });

  test("surfaces authenticated read timeouts", async () => {
    jest.useFakeTimers();
    global.fetch.mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
    );

    const pending = http.authedGetJSON("/slow", "token");
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await jest.advanceTimersByTimeAsync(15_000);
    await rejection;
  });

  test("surfaces authenticated read network failures", async () => {
    const failure = new TypeError("network down");
    global.fetch.mockRejectedValue(failure);

    await expect(http.authedGetJSON("/orders", "token")).rejects.toBe(failure);
  });

  test("attaches timeout signals to authenticated reads and mutations", async () => {
    global.fetch
      .mockResolvedValueOnce(response(200, { ok: true }))
      .mockResolvedValueOnce(response(204, null));

    await http.authedGetJSON("/read", "token");
    await http.authedMutationJSON("/write", "token", { method: "POST" });

    expect(global.fetch.mock.calls[0][1].signal).toEqual(expect.any(AbortSignal));
    expect(global.fetch.mock.calls[1][1].signal).toEqual(expect.any(AbortSignal));
  });

  test.each([
    ["public read", () => http.getJSON("/empty")],
    ["authenticated read", () => http.authedGetJSON("/empty", "token")],
    ["authenticated mutation", () => http.authedMutationJSON("/empty", "token", { method: "POST" })]
  ])("returns null for a successful empty %s response", async (_label, request) => {
    global.fetch.mockResolvedValue(emptyResponse(200));

    await expect(request()).resolves.toBeNull();
  });

  test("returns null for a 204 public read without parsing JSON", async () => {
    const noContentResponse = emptyResponse(204);
    global.fetch.mockResolvedValue(noContentResponse);

    await expect(http.getJSON("/no-content")).resolves.toBeNull();
    expect(noContentResponse.json).not.toHaveBeenCalled();
  });

  test("sends the explicit app language on public reads", async () => {
    global.fetch.mockResolvedValue(response(200, { ok: true }));

    await expect(http.getJSON("/api/v1/products", { lang: "ar" })).resolves.toEqual({ ok: true });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/api/v1/products", {
      headers: { "x-lang": "ar" },
      signal: expect.any(AbortSignal)
    });
  });

  test("returns null for optional connection failures and 404 responses", async () => {
    global.fetch
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(response(404, { message: "missing" }));

    await expect(http.getJSON("/offline")).resolves.toBeNull();
    await expect(http.getJSON("/missing")).resolves.toBeNull();
  });

  test("can surface a public connection failure when requested", async () => {
    const failure = new TypeError("network down");
    global.fetch.mockRejectedValue(failure);

    await expect(http.getJSON("/required", { throwOnError: true })).rejects.toBe(failure);
  });

  test("refreshes once and retries an authenticated read with the latest token", async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue("fresh-token");
    http.configureAuthSessionAdapter({
      getAccessToken: () => "stale-token",
      getSessionRevision: () => 1,
      refreshAccessToken
    });
    global.fetch
      .mockResolvedValueOnce(response(401, { message: "expired" }))
      .mockResolvedValueOnce(response(200, { items: [1] }));

    await expect(
      http.authedGetJSON("/api/v1/orders", "stale-token", { lang: "en" })
    ).resolves.toEqual({ items: [1] });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenNthCalledWith(1, "https://api.example.com/api/v1/orders", {
      headers: { authorization: "Bearer stale-token", "x-lang": "en" },
      signal: expect.any(AbortSignal)
    });
    expect(global.fetch).toHaveBeenNthCalledWith(2, "https://api.example.com/api/v1/orders", {
      headers: { authorization: "Bearer fresh-token", "x-lang": "en" },
      signal: expect.any(AbortSignal)
    });
  });

  test("never retries a mutation when retryOn401 is false", async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue("fresh-token");
    http.configureAuthSessionAdapter({
      getAccessToken: () => "fresh-token",
      getSessionRevision: () => 1,
      refreshAccessToken
    });
    global.fetch.mockResolvedValue(response(401, { message: "Please sign in again" }));

    await expect(
      http.authedMutationJSON(
        "/api/v1/checkout",
        "stale-token",
        { method: "POST", body: { items: [] } },
        { retryOn401: false }
      )
    ).rejects.toThrow("Please sign in again");

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("serializes authenticated mutations and supports empty success responses", async () => {
    global.fetch.mockResolvedValue(response(204, null));

    await expect(
      http.authedMutationJSON(
        "/api/v1/wishlist/product/4",
        "token",
        { method: "DELETE" },
        { lang: "ar" }
      )
    ).resolves.toBeNull();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/wishlist/product/4",
      {
        body: undefined,
        headers: { authorization: "Bearer token", "x-lang": "ar" },
        method: "DELETE",
        signal: expect.any(AbortSignal)
      }
    );
  });

  test("does not retry an old request after the signed-in account changes", async () => {
    let revision = 1;
    let accessToken = "user-a-token";
    const refreshAccessToken = jest.fn().mockResolvedValue("user-b-token");
    http.configureAuthSessionAdapter({
      getAccessToken: () => accessToken,
      getSessionRevision: () => revision,
      refreshAccessToken
    });
    global.fetch.mockImplementationOnce(async () => {
      revision = 2;
      accessToken = "user-b-token";
      return response(401, { message: "expired" });
    });

    const pending = http.authedMutationJSON(
      "/api/v1/wishlist",
      "user-a-token",
      { method: "POST", body: { entityType: "product", entityId: 1 } }
    );
    await expect(pending).rejects.toThrow("expired");
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("reuses an already-rotated token without starting another refresh", async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue("newer-token");
    http.configureAuthSessionAdapter({
      getAccessToken: () => "fresh-token",
      getSessionRevision: () => 1,
      refreshAccessToken,
      ownsToken: (token) => token === "stale-token" || token === "fresh-token"
    });
    global.fetch
      .mockResolvedValueOnce(response(401, { message: "expired" }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await expect(
      http.authedGetJSON("/api/v1/orders", "stale-token")
    ).resolves.toEqual({ ok: true });

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenNthCalledWith(2, "https://api.example.com/api/v1/orders", {
      headers: { authorization: "Bearer fresh-token" },
      signal: expect.any(AbortSignal)
    });
  });

  test("does not retry the same token after refresh returns no replacement", async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue(null);
    http.configureAuthSessionAdapter({
      getAccessToken: () => "failed-token",
      getSessionRevision: () => 1,
      refreshAccessToken
    });
    global.fetch.mockResolvedValue(response(401, { message: "Expired" }));

    await expect(http.authedGetJSON("/orders", "failed-token")).rejects.toThrow("Expired");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("preserves HTTP status and API code from a coded error envelope", async () => {
    global.fetch.mockResolvedValue(
      response(409, { code: "SHIPPING_QUOTE_CHANGED", message: "Review total" })
    );

    await expect(http.getJSON("/checkout", { throwOnError: true })).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "SHIPPING_QUOTE_CHANGED",
      message: "Review total"
    });
  });

  test("uses the { error } envelope message when no message field exists", async () => {
    global.fetch.mockResolvedValue(response(400, { error: "Invalid request payload" }));

    await expect(http.getJSON("/checkout", { throwOnError: true })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Invalid request payload"
    });
  });

  test("keeps a coded feature-policy error identifiable to consumers", async () => {
    global.fetch.mockResolvedValue(
      response(409, { code: "FEATURE_UPDATE_REQUIRED", message: "Update to continue" })
    );

    const error = await http
      .getJSON("/checkout", { throwOnError: true })
      .catch((thrown) => thrown);

    expect(http.ApiError).toBeDefined();
    expect(error).toBeInstanceOf(http.ApiError);
    expect(error).toMatchObject({ status: 409, code: "FEATURE_UPDATE_REQUIRED" });
  });

  test("falls back to a safe status/path message for non-JSON error bodies", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token <")),
      text: jest.fn().mockResolvedValue("<html>error</html>")
    });

    await expect(http.getJSON("/boom", { throwOnError: true })).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "API 500 /boom"
    });
  });

  test("ignores non-string message and code fields", async () => {
    global.fetch.mockResolvedValue(
      response(500, { message: { nested: true }, code: 123 })
    );

    const error = await http
      .authedGetJSON("/orders/1", "token")
      .catch((thrown) => thrown);

    expect(error).toMatchObject({ status: 500, message: "API 500 /orders/1" });
    expect(error.code).toBeUndefined();
  });

  test("does not replay a mutation whose token belongs to another session", async () => {
    let accessToken = "user-b-token";
    const refreshAccessToken = jest.fn().mockResolvedValue("user-b-token-2");
    http.configureAuthSessionAdapter({
      getAccessToken: () => accessToken,
      getSessionRevision: () => 2,
      refreshAccessToken,
      ownsToken: (token) => token === accessToken
    });
    global.fetch.mockResolvedValue(response(401, { message: "expired" }));

    await expect(
      http.authedMutationJSON("/api/v1/wishlist", "user-a-token", {
        method: "POST",
        body: {}
      })
    ).rejects.toThrow("expired");

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("does not replay after the auth adapter is replaced mid-request", async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue("next");
    http.configureAuthSessionAdapter({
      getAccessToken: () => "token",
      getSessionRevision: () => 1,
      refreshAccessToken,
      ownsToken: () => true
    });
    global.fetch.mockImplementationOnce(async () => {
      http.configureAuthSessionAdapter({
        getAccessToken: () => "other",
        getSessionRevision: () => 1,
        refreshAccessToken: jest.fn()
      });
      return response(401, { message: "expired" });
    });

    await expect(http.authedGetJSON("/orders", "token")).rejects.toThrow("expired");
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  test("rejects a successful response belonging to an account that changed during its body read", async () => {
    let revision = 1;
    http.configureAuthSessionAdapter({ getAccessToken: () => "token", getSessionRevision: () => revision,
      refreshAccessToken: async () => null });
    global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => {
      revision = 2; return JSON.stringify({ privateOrders: [1] });
    } });
    await expect(http.authedGetJSON("/orders", "token")).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  });

  test.each([
    ["public", () => http.getJSON("/bad-json", { throwOnError: true })],
    ["authenticated", () => http.authedGetJSON("/bad-json", "token")],
    ["mutation", () => http.authedMutationJSON("/bad-json", "token", { method: "PUT", body: {} })]
  ])("malformed successful %s JSON retains its status and a safe machine-readable failure", async (_label, read) => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => "<html>private upstream details</html>" });
    await expect(read()).rejects.toMatchObject({ status: 200, code: "INVALID_PAYLOAD", message: "Invalid API response" });
  });
});
