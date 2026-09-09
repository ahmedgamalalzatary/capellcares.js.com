import { describe, expect, it } from "vitest";
import { paymentStatusChip } from "@/components/orders/order-presentation";

describe("paymentStatusChip", () => {
  it("uses green text for accepted payments", () => {
    expect(paymentStatusChip("accepted")).toContain("chip--status-ok");
  });

  it("uses red text for pending and denied payments", () => {
    expect(paymentStatusChip("pending")).toContain("chip--status-bad");
    expect(paymentStatusChip("denied")).toContain("chip--status-bad");
  });
});
