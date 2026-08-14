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

  test.each([
    ["public", () => http.getJSON("/slow")],
    ["authenticated", () => http.authedGetJSON("/slow", "token")]
  ])("returns null when an optional %s read times out", async (_label, request) => {
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

    const pending = request();
    const resolution = expect(pending).resolves.toBeNull();
    await jest.advanceTimersByTimeAsync(15_000);

    await resolution;
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
      refreshAccessToken
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
});
