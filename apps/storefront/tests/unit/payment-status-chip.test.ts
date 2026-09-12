import { describe, expect, it } from "vitest";
import { orderPaymentLabel, paymentStatusChip } from "@/components/orders/order-presentation";
import { getDict } from "@capella/shared";

describe("paymentStatusChip", () => {
  it("uses green text for accepted payments", () => {
    expect(paymentStatusChip("accepted")).toContain("chip--status-ok");
  });

  it("uses red text for pending and denied payments", () => {
    expect(paymentStatusChip("pending")).toContain("chip--status-bad");
    expect(paymentStatusChip("denied")).toContain("chip--status-bad");
  });
});

describe("orderPaymentLabel", () => {
  it("shows a confirmed Paymob payment as paid even while the operational order is pending", () => {
    expect(orderPaymentLabel({ paymentMethod: "paymob", paymentStatus: "pending",
      providerPaymentStatus: "succeeded" }, getDict("en"))).toBe("Paid online");
  });

  it("shows a refunded Paymob order as refunded rather than accepted", () => {
    expect(orderPaymentLabel({ paymentMethod: "paymob", paymentStatus: "pending",
      providerPaymentStatus: "refunded" }, getDict("en"))).toBe("Refunded");
  });
});
