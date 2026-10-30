import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiBase } from "../src/api/base.js";

type BrowserGlobals = { window: unknown };

function withBrowserLocation<T>(
  location: { protocol: string; hostname: string; port?: string },
  run: () => T
): T {
  const scope = globalThis as unknown as BrowserGlobals;
  const hadWindow = "window" in scope;
  const previous = scope.window;
  scope.window = { location: { port: "", ...location } };

  try {
    return run();
  } finally {
    if (hadWindow) {
      scope.window = previous;
    } else {
      delete scope.window;
    }
  }
}

test("the internal API URL wins on the server", () => {
  assert.equal(
    resolveApiBase(
      {
        API_INTERNAL_URL: "http://api:4000",
        NEXT_PUBLIC_API_URL: "http://localhost:4000"
      } as NodeJS.ProcessEnv,
      { isServer: true }
    ),
    "http://api:4000"
  );
});

test("browser execution falls back to the explicit public API URL", () =>
  withBrowserLocation(
    { protocol: "http:", hostname: "localhost", port: "3000" },
    () =>
      assert.equal(
        resolveApiBase({
          API_INTERNAL_URL: "http://api:4000",
          NEXT_PUBLIC_API_URL: "http://localhost:4000"
        } as unknown as NodeJS.ProcessEnv),
        "http://localhost:4000"
      )
  ));

test("localhost browsers derive port 4000 when no public API URL is set", () =>
  withBrowserLocation({ protocol: "http:", hostname: "localhost" }, () =>
    assert.equal(resolveApiBase({} as NodeJS.ProcessEnv), "http://localhost:4000")
  ));

test("the ERP domain falls back to the production API host", () =>
  withBrowserLocation({ protocol: "https:", hostname: "erp.faltatoy.com" }, () =>
    assert.equal(resolveApiBase({} as NodeJS.ProcessEnv), "https://api.faltatoy.com")
  ));

test("the storefront domain falls back to the production API host", () =>
  withBrowserLocation({ protocol: "https:", hostname: "faltatoy.com" }, () =>
    assert.equal(resolveApiBase({} as NodeJS.ProcessEnv), "https://api.faltatoy.com")
  ));

test("the www storefront domain falls back to the production API host", () =>
  withBrowserLocation({ protocol: "https:", hostname: "www.faltatoy.com" }, () =>
    assert.equal(resolveApiBase({} as NodeJS.ProcessEnv), "https://api.faltatoy.com")
  ));
