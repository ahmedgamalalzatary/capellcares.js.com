import { describe, expect, it } from "vitest";

import { serializeJsonLd } from "@/lib/seo";

describe("serializeJsonLd", () => {
  it("cannot be broken out of by a closing script tag in stored text", () => {
    const html = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("</script");
    expect(html).not.toContain("<");
  });

  it("still parses back to the original data", () => {
    const payload = { name: "Cream <b> & \u2028 \"lotion\"", price: 10 };
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });
});
