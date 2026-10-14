import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ api: { get: apiGet } }));

import { usePaymentSummary } from "@/features/dashboard/hooks/use-payment-summary";

beforeEach(() => apiGet.mockReset());

describe("usePaymentSummary", () => {
  it("does nothing when disabled", () => {
    const { result } = renderHook(() => usePaymentSummary(null, false));
    expect(result.current).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("asks for all-time counts without a start date", async () => {
    apiGet.mockResolvedValueOnce({ accepted: 3, pending: 1, denied: 0 });
    const { result } = renderHook(() => usePaymentSummary(null, true));
    await waitFor(() => expect(result.current).toEqual({ accepted: 3, pending: 1, denied: 0 }));
    expect(apiGet).toHaveBeenCalledWith("/api/erp/orders/payment-summary");
  });

  it("asks for counts since a date", async () => {
    apiGet.mockResolvedValueOnce({ accepted: 1, pending: 0, denied: 0 });
    const since = new Date("2026-10-07T00:00:00.000Z");
    renderHook(() => usePaymentSummary(since, true));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/api/erp/orders/payment-summary?since=2026-10-07T00%3A00%3A00.000Z"));
  });
});
