import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeEgyptianPhone } from "../src/constants/phone.js";

describe("normalizeEgyptianPhone", () => {
  it("writes every accepted Egyptian mobile format as +20 followed by the 10-digit number", () => {
    for (const input of ["01012345678", "+201012345678", "00201012345678", "1012345678"]) {
      assert.equal(normalizeEgyptianPhone(input), "+201012345678", input);
    }
  });

  it("ignores spaces, dashes and brackets that customers or staff type", () => {
    assert.equal(normalizeEgyptianPhone(" 010 1234-5678 "), "+201012345678");
    assert.equal(normalizeEgyptianPhone("+20 (101) 234 5678"), "+201012345678");
  });

  it("leaves a value it cannot recognise as an Egyptian mobile unchanged apart from trimming", () => {
    assert.equal(normalizeEgyptianPhone(" 12345 "), "12345");
    assert.equal(normalizeEgyptianPhone("+447700900123"), "+447700900123");
  });
});

