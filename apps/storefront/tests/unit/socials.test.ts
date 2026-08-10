import { describe, expect, it } from "vitest";

import { SOCIAL_LINKS } from "@/constants/socials";

describe("SOCIAL_LINKS", () => {
  it("uses the customer-service WhatsApp number", () => {
    const whatsapp = SOCIAL_LINKS.find((entry) => entry.label === "WhatsApp");

    expect(whatsapp?.href).toBe("https://wa.me/201034668590");
  });
});
