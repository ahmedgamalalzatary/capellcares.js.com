import { expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

it("answers frontend health probes without caching the response", async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
