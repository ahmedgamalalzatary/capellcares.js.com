import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/i18n/en.ts";
import { ar } from "../src/i18n/ar.ts";

test("the assistant button is named Ask Falta", () => {
  assert.equal(en.ask.button, "Ask Falta");
  assert.equal(ar.ask.button, "اسأل فلتة");
});
