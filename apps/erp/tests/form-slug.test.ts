import { describe, expect, it } from "vitest";

import { slugifyFormName } from "@/components/forms/form-slug";

describe("slugifyFormName", () => {
  it("normalizes English names into URL-safe slugs", () => {
    expect(slugifyFormName("  Rose Body Lotion 200ML  ")).toBe("rose-body-lotion-200ml");
  });

  it("strips leading and trailing separators", () => {
    expect(slugifyFormName("---Offer Bundle---")).toBe("offer-bundle");
  });
});
