import assert from "node:assert/strict";
import { inspect } from "node:util";
import test from "node:test";
import { loadBostaConfig } from "../../src/modules/shipping/bosta/bosta-config.js";

const BASE_ENV = {
  BOSTA_API_KEY: "test-key-123",
  BOSTA_BASE_URL: "https://stg-app.bosta.co/api/v2",
  BOSTA_WEBHOOK_SECRET: "webhook-secret",
  BOSTA_ENABLED: "false"
};

function loadWith(overrides: Record<string, string | undefined>) {
  return loadBostaConfig({ ...BASE_ENV, ...overrides });
}

test("inactive integration requires no credentials and performs no provider writes", () => {
  const config = loadBostaConfig({ BOSTA_ENABLED: "false", BOSTA_API_KEY: undefined, BOSTA_BASE_URL: undefined, BOSTA_WEBHOOK_SECRET: undefined });
  assert.equal(config.enabled, false);
  assert.equal(config.apiKey, null);
  assert.equal(config.canCallProvider, false);
});

test("enabled integration fails clearly when the API key is missing", () => {
  assert.throws(() => loadWith({ BOSTA_ENABLED: "true", BOSTA_API_KEY: undefined }), /BOSTA_API_KEY/);
});

test("enabled integration fails clearly when the base URL is missing", () => {
  assert.throws(() => loadWith({ BOSTA_ENABLED: "true", BOSTA_BASE_URL: undefined }), /BOSTA_BASE_URL/);
});

test("enabled integration fails clearly when the webhook secret is missing", () => {
  assert.throws(() => loadWith({ BOSTA_ENABLED: "true", BOSTA_WEBHOOK_SECRET: undefined }), /BOSTA_WEBHOOK_SECRET/);
});

test("enabled integration rejects a non-HTTPS base URL", () => {
  assert.throws(() => loadWith({ BOSTA_ENABLED: "true", BOSTA_BASE_URL: "http://app.bosta.co/api/v2" }), /https/i);
});

test("enabled integration with full config can call the provider", () => {
  const config = loadWith({ BOSTA_ENABLED: "true" });
  assert.equal(config.enabled, true);
  assert.equal(config.canCallProvider, true);
  assert.equal(config.apiKey, "test-key-123");
  assert.equal(config.baseUrl, "https://stg-app.bosta.co/api/v2");
});

test("the API key never appears in the serialized config", () => {
  const config = loadWith({ BOSTA_ENABLED: "true" });
  const serialized = JSON.stringify(config);
  assert.ok(!serialized.includes("test-key-123"), "API key must be redacted from serialization");
});

// --- R05: invalid URL / timeout / activation values must fail clearly ---

test("R05: a malformed HTTPS base URL is rejected", () => {
  assert.throws(() => loadWith({ BOSTA_ENABLED: "true", BOSTA_BASE_URL: "https://" }), /BOSTA_BASE_URL/);
});

test("R05: a base URL with credentials or query is rejected", () => {
  assert.throws(() => loadWith({ BOSTA_ENABLED: "true", BOSTA_BASE_URL: "https://user:pass@app.bosta.co/api/v2" }), /BOSTA_BASE_URL/);
  assert.throws(() => loadWith({ BOSTA_ENABLED: "true", BOSTA_BASE_URL: "https://app.bosta.co/api/v2?x=1" }), /BOSTA_BASE_URL/);
});

test("R05: non-finite, zero, negative and fractional timeouts are rejected", () => {
  for (const bad of ["nope", "-1", "0", "1.5"]) {
    assert.throws(
      () => loadWith({ BOSTA_ENABLED: "true", BOSTA_TIMEOUT_MS: bad }),
      /BOSTA_TIMEOUT_MS/,
      `timeout ${bad} must be rejected`
    );
  }
});

test("R05: an invalid activation value is reported, not silently disabled", () => {
  assert.throws(() => loadWith({ BOSTA_ENABLED: "yes" }), /BOSTA_ENABLED/);
});

test("R05: a valid timeout and staging/production base paths are accepted", () => {
  const staging = loadWith({ BOSTA_ENABLED: "true", BOSTA_TIMEOUT_MS: "5000" });
  assert.equal(staging.timeoutMs, 5000);
  const prod = loadWith({ BOSTA_ENABLED: "true", BOSTA_BASE_URL: "https://app.bosta.co/api/v2" });
  assert.equal(prod.baseUrl, "https://app.bosta.co/api/v2");
});

// --- R04: ordinary Node inspection must not expose credentials ---

test("R04: node:util inspect does not expose the API key or webhook secret", () => {
  const config = loadWith({ BOSTA_ENABLED: "true" });
  const shown = inspect(config);
  assert.ok(!shown.includes("test-key-123"), "inspect must not leak the API key");
  assert.ok(!shown.includes("webhook-secret"), "inspect must not leak the webhook secret");
});

test("R04: spreading the config does not carry plaintext secrets", () => {
  const config = loadWith({ BOSTA_ENABLED: "true" });
  const spread = { ...config };
  assert.ok(!JSON.stringify(spread).includes("test-key-123"));
  assert.ok(!JSON.stringify(spread).includes("webhook-secret"));
});

// ---  inspect actual spread values, independent of any toJSON closure ---
test(" spread object entries do not contain plaintext secrets", () => {
  const config = loadWith({ BOSTA_ENABLED: "true" });
  const spread = { ...config } as Record<string, unknown>;
  const stringEntries = Object.fromEntries(
    Object.entries(spread).filter(([, value]) => typeof value === "string")
  );
  assert.ok(!Object.values(stringEntries).includes("test-key-123"), "spread must not contain the plaintext API key");
  assert.ok(!Object.values(stringEntries).includes("webhook-secret"), "spread must not contain the plaintext webhook secret");
  assert.ok(spread.apiKey !== "test-key-123", "spread apiKey must not be the plaintext key");
  assert.ok(spread.webhookSecret !== "webhook-secret", "spread webhookSecret must not be plaintext");
});
