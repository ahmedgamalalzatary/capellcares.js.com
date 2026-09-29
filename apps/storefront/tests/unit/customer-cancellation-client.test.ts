import { afterEach, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";

afterEach(() => vi.unstubAllGlobals());
it("posts authenticated cancellation to the owned order endpoint and returns its refreshed state", async () => {
  const order = { id: 12, fulfillment: { status: "cancellation_pending", canCancel: false } };
  const fetch = vi.fn().mockResolvedValue(Response.json(order, { status: 202 }));
  vi.stubGlobal("fetch", fetch);
  await expect(client.cancelCustomerOrder(12, "token")).resolves.toEqual(order);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/orders/12/cancel"), expect.objectContaining({ method: "POST", cache: "no-store", headers: { authorization: "Bearer token" } }));
});
