import assert from "node:assert/strict";
import test from "node:test";
import { BostaClient, BostaProviderError } from "../../src/modules/shipping/bosta/bosta-client.js";

const CONFIG = {
  enabled: true,
  canCallProvider: true,
  apiKey: "test-key-123",
  baseUrl: "https://stg-app.bosta.co/api/v2",
  webhookSecret: "webhook-secret",
  timeoutMs: 50
};

function clientWithFetch(fetchImpl: typeof fetch) {
  return new BostaClient(CONFIG, fetchImpl);
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("sends the API key in the Authorization header over HTTPS", async () => {
  let seenUrl = "";
  let seenAuth = "";
  const client = clientWithFetch(async (url, init) => {
    seenUrl = String(url);
    seenAuth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
    return jsonResponse(200, { success: true });
  });
  await client.get("/cities");
  assert.ok(seenUrl.startsWith("https://"), "must use HTTPS");
  assert.equal(seenAuth, "test-key-123");
});

test("classifies a 4xx response as a definitive rejection", async () => {
  const client = clientWithFetch(async () => jsonResponse(422, { message: "invalid district" }));
  await assert.rejects(client.get("/cities"), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "definitive");
    assert.equal(error.status, 422);
    return true;
  });
});

test("classifies a 429 response as throttled and retryable", async () => {
  const client = clientWithFetch(async () => jsonResponse(429, { message: "slow down" }));
  await assert.rejects(client.get("/cities"), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "throttled");
    return true;
  });
});

test("classifies a GET 5xx response as a transient provider error", async () => {
  const client = clientWithFetch(async () => jsonResponse(500, { message: "boom" }));
  await assert.rejects(client.get("/cities"), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "transient");
    return true;
  });
});

test("classifies a timeout as ambiguous, never as a definite rejection", async () => {
  const client = clientWithFetch(async (_url, init) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  });
  await assert.rejects(client.get("/cities"), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "ambiguous");
    return true;
  });
});

test("a network failure is ambiguous, not definitive", async () => {
  const client = clientWithFetch(async () => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(client.get("/cities"), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "ambiguous");
    return true;
  });
});

test("the API key is redacted from error messages", async () => {
  const client = clientWithFetch(async () => jsonResponse(401, { message: "invalid key test-key-123 provided" }));
  await assert.rejects(client.get("/cities"), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.ok(!error.message.includes("test-key-123"), "API key must not leak into error messages");
    return true;
  });
});

test("an inactive client performs no provider call", async () => {
  let called = false;
  const client = new BostaClient({ ...CONFIG, enabled: false, canCallProvider: false, apiKey: null }, (async () => {
    called = true;
    return jsonResponse(200, {});
  }) as typeof fetch);
  await assert.rejects(client.get("/cities"), /inactive/i);
  assert.equal(called, false);
});

// --- R03: uncertain writes must not be treated as retryable failure or success ---

test("R03: a POST 5xx is ambiguous (uncertain write), not transient", async () => {
  const client = clientWithFetch(async () => jsonResponse(502, { message: "bad gateway" }));
  await assert.rejects(client.post("/deliveries", {}), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "ambiguous", "a write that may have been processed must be ambiguous");
    return true;
  });
});

test("R03: a POST 200 with a malformed body is an uncertain outcome, not success", async () => {
  const client = clientWithFetch(async () => new Response("not json", { status: 200, headers: { "content-type": "text/plain" } }));
  await assert.rejects(client.post("/deliveries", {}), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "ambiguous", "an unparseable write response is an uncertain outcome");
    return true;
  });
});

test("R03: a malformed error payload still preserves the HTTP status classification", async () => {
  const client = clientWithFetch(async () => new Response("not json", { status: 422, headers: { "content-type": "text/plain" } }));
  await assert.rejects(client.post("/deliveries", {}), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "definitive");
    assert.equal(error.status, 422);
    return true;
  });
});

// --- R04: the webhook secret must be redacted from errors too ---

test("R04: the webhook secret is redacted from provider error messages", async () => {
  const client = clientWithFetch(async () => jsonResponse(401, { message: "webhook-secret" }));
  await assert.rejects(client.get("/cities"), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.ok(!error.message.includes("webhook-secret"), "webhook secret must not leak into error messages");
    return true;
  });
});

// ---  non-string error messages must not erase the known HTTP status ---
test(" a non-string error message preserves the HTTP status and classification", async () => {
  for (const message of [{ text: "invalid district" }, ["a", "b"], 42, null]) {
    const client = clientWithFetch(async () => jsonResponse(422, { message }));
    await assert.rejects(client.get("/cities"), (error: unknown) => {
      assert.ok(error instanceof BostaProviderError);
      assert.equal(error.kind, "definitive", `message ${JSON.stringify(message)} must keep definitive status`);
      assert.equal(error.status, 422);
      return true;
    });
  }
});

test(" malformed successful GET is response validation, not an uncertain write", async () => {
  const client = clientWithFetch(async () => new Response("not json", { status: 200 }));
  await assert.rejects(client.get("/pricing/shipment/calculator"), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "BostaResponseValidationError");
    assert.ok(!(error instanceof BostaProviderError));
    assert.equal((error as Error & { status: number }).status, 200);
    return true;
  });
});

test(" empty reads remain endpoint-specific and empty writes remain uncertain", async () => {
  const client = clientWithFetch(async () => new Response(null, { status: 204 }));
  assert.equal(await client.get("/cities"), null);
  await assert.rejects(client.post("/deliveries", {}), (error: unknown) => {
    assert.ok(error instanceof BostaProviderError);
    assert.equal(error.kind, "ambiguous");
    assert.equal(error.status, 204);
    return true;
  });
});
