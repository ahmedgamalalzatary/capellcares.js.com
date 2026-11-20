import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeKuwaitiPhone } from "../src/constants/phone.js";

describe("normalizeKuwaitiPhone", () => {
  it("writes every accepted Kuwaiti mobile format as +965 followed by the 8-digit number", () => {
    for (const input of ["55123456", "+96555123456", "0096555123456"]) {
      assert.equal(normalizeKuwaitiPhone(input), "+96555123456", input);
    }
    assert.equal(normalizeKuwaitiPhone("99887766"), "+96599887766");
    assert.equal(normalizeKuwaitiPhone("65432100"), "+96565432100");
  });

  it("ignores spaces, dashes and brackets that customers or staff type", () => {
    assert.equal(normalizeKuwaitiPhone(" 5512-3456 "), "+96555123456");
    assert.equal(normalizeKuwaitiPhone("+965 (5512) 3456"), "+96555123456");
  });

  it("leaves a value it cannot recognise as a Kuwaiti mobile unchanged apart from trimming", () => {
    assert.equal(normalizeKuwaitiPhone(" 12345 "), "12345");
    assert.equal(normalizeKuwaitiPhone("01012345678"), "01012345678");
    assert.equal(normalizeKuwaitiPhone("+447700900123"), "+447700900123");
  });
});
