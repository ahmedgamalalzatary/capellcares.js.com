import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatPrice, getDict } from "@capella/shared";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";

const resolved = [{ key: "p1", index: 0, title: "Toy", meta: "One", unit: 1.125, qty: 2 }];
const dict = getDict("en");
// toHaveTextContent folds the non-breaking space formatPrice puts after "KWD".
const price = (amount: number) => formatPrice(amount, "en").replace(/\s/g, " ");

describe("CheckoutSummary", () => {
  it("asks for an area before showing the delivery fee", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25} quote={null} quoteState="idle" />);
    expect(screen.getByText(dict.checkout.chooseArea)).toBeInTheDocument();
    expect(screen.getByTestId("checkout-total")).toHaveTextContent(price(2.25));
  });

  it("adds the area's delivery fee to the total", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25}
      quote={{ subtotal: 2.25, deliveryFee: 1.5, total: 3.75 }} quoteState="ready" />);
    expect(screen.getByTestId("checkout-delivery")).toHaveTextContent(price(1.5));
    expect(screen.getByTestId("checkout-total")).toHaveTextContent(price(3.75));
  });

  it("says free when the area costs nothing", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25}
      quote={{ subtotal: 2.25, deliveryFee: 0, total: 2.25 }} quoteState="ready" />);
    expect(screen.getByTestId("checkout-delivery")).toHaveTextContent(dict.common.freeDelivery);
  });

  it("tells the customer when the fee could not be worked out", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25} quote={null} quoteState="error" />);
    expect(screen.getByText(dict.checkout.deliveryQuoteFailed)).toBeInTheDocument();
  });

  const promoState = (dto: object, productsTotal: number) => ({ savedCode: "save10", saveCode: () => {}, signedIn: true, loginHref: "/en/login",
    preview: async () => null, notice: null, productsTotal, confirmation: null, confirm: () => {}, decline: () => {}, result: dto as never, applied: dto as never });

  it("shows each line at what is paid, and the code's saving separately from the sale prices it replaced", () => {
    const dto = { status: "applied" as const, code: "SAVE10", arName: "خصم", enName: "Save", discount: 1.2, saleGivenUp: 2, freeShipping: false, replacedSales: [] };
    render(<CheckoutSummary lang="en" dict={dict} subtotal={10} quote={null} quoteState="idle" promo={promoState(dto, 10.8)}
      resolved={[{ key: "p1", index: 0, title: "Swing", meta: "Blue", unit: 10, qty: 1, lineTotal: 10.8 }]} />);
    expect(screen.getByText("Swing").closest("li")!).toHaveTextContent(price(10.8));
    expect(screen.getByText("Promo code (SAVE10)").parentElement).toHaveTextContent(`- ${price(1.2)}`);
    expect(screen.getByText("Sale prices replaced by the code").parentElement).toHaveTextContent(`+ ${price(2)}`);
    // Subtotal + replaced sales - code saving = the total charged: 10 + 2 - 1.2 = 10.8.
    expect(screen.getByText("Subtotal").parentElement).toHaveTextContent(price(10));
    expect(screen.getByTestId("checkout-total")).toHaveTextContent(price(10.8));
  });

  it("shows delivery as free with the fee the code waived", () => {
    render(<CheckoutSummary lang="en" dict={dict} resolved={resolved} subtotal={2.25}
      quote={{ subtotal: 2.25, deliveryFee: 0, deliveryFeeWaived: 1.5, total: 2.25 }} quoteState="ready" />);
    const delivery = screen.getByTestId("checkout-delivery");
    expect(delivery).toHaveTextContent(dict.promo.freeDeliveryWithCode);
    expect(delivery.querySelector("del")).toHaveTextContent(price(1.5));
  });

  it("lists the code's free gift, or says it is out of stock", () => {
    const base = { status: "applied" as const, code: "GIFT", arName: "هدية", enName: "Gift", discount: 0, saleGivenUp: 0, freeShipping: false, replacedSales: [] };
    const { unmount } = render(<CheckoutSummary lang="en" dict={dict} resolved={[]} subtotal={3.5} quote={null} quoteState="idle"
      promo={promoState({ ...base, gift: { nameAr: "كرة", nameEn: "Ball", qty: 2, value: 8 } }, 3.5)} />);
    expect(screen.getByText("Free gift: Ball × 2").parentElement).toHaveTextContent("Free");
    unmount();
    render(<CheckoutSummary lang="en" dict={dict} resolved={[]} subtotal={3.5} quote={null} quoteState="idle"
      promo={promoState({ ...base, discount: 0.5, gift: null, giftUnavailable: true }, 3)} />);
    expect(screen.getByText("The free gift is out of stock; the rest of the code still applies.")).toBeInTheDocument();
  });
});
