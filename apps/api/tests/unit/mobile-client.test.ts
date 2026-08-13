import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";

import {
  canExposeRefreshToken,
  extractRefreshToken,
  isMobileClient
} from "../../src/modules/auth/mobile-client.js";

const cookieName = "refresh_cookie";

function request(input: {
  client?: string;
  origin?: string;
  cookie?: string;
  header?: string;
  body?: string;
}): Request {
  const headers = new Map<string, string>();
  if (input.client !== undefined) headers.set("x-client", input.client);
  if (input.origin !== undefined) headers.set("origin", input.origin);
  if (input.header !== undefined) headers.set("x-refresh-token", input.header);

  return {
    cookies: input.cookie === undefined ? {} : { [cookieName]: input.cookie },
    body: input.body === undefined ? {} : { refreshToken: input.body },
    get(name: string) {
      return headers.get(name.toLowerCase());
    }
  } as Request;
}

test("isMobileClient requires the explicit mobile client header", () => {
  assert.equal(isMobileClient(request({ client: "mobile" })), true);
  assert.equal(isMobileClient(request({ client: "mobile", origin: "https://store.example" })), false);
  assert.equal(isMobileClient(request({ client: "web" })), false);
  assert.equal(isMobileClient(request({})), false);
});

test("extractRefreshToken separates web cookie and mobile header or body transport", () => {
  assert.equal(
    extractRefreshToken(request({ cookie: "cookie", header: "header", body: "body" }), cookieName),
    "cookie"
  );
  assert.equal(
    extractRefreshToken(request({ client: "mobile", cookie: "cookie", header: "header", body: "body" }), cookieName),
    "header"
  );
  assert.equal(extractRefreshToken(request({ client: "mobile", body: "body" }), cookieName), "body");
  assert.equal(extractRefreshToken(request({ client: "mobile", cookie: "cookie" }), cookieName), undefined);
  assert.equal(extractRefreshToken(request({ header: "header" }), cookieName), undefined);
  assert.equal(extractRefreshToken(request({}), cookieName), undefined);
});

test("canExposeRefreshToken requires mobile header or body token transport", () => {
  assert.equal(
    canExposeRefreshToken(request({ client: "mobile", cookie: "cookie", header: "header" }), cookieName),
    true
  );
  assert.equal(
    canExposeRefreshToken(request({ client: "mobile", header: "header" }), cookieName),
    true
  );
  assert.equal(
    canExposeRefreshToken(request({ client: "mobile", body: "body" }), cookieName),
    true
  );
  assert.equal(canExposeRefreshToken(request({ header: "header" }), cookieName), false);
});
