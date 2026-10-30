import { describe, expect, it } from "vitest";

import { SOCIAL_LINKS } from "@/constants/socials";

describe("SOCIAL_LINKS", () => {
  it("never points customers at the old Capella accounts", () => {
    for (const { href } of SOCIAL_LINKS) {
      expect(href).not.toMatch(/capella|201034668590/i);
    }
  });
});
