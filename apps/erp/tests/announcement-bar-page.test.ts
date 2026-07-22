import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("provides an ERP announcement bar route", () => {
  const pagePath = resolve(process.cwd(), "src/app/announcement-bar/page.tsx");
  expect(existsSync(pagePath)).toBe(true);
});
