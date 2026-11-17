import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("erp next config", () => {
  it("sends security headers on every route, including clickjacking protection", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((entry) => entry.source === "/:path*");
    const headers = Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
  });
});
