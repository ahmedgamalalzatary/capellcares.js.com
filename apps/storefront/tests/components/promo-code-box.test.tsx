import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDict, type CheckoutPriceResponseDto } from "@capella/shared";
import { PromoCodeBox } from "@/components/checkout/promo-code-box";
import { salesSignature } from "@/lib/promo/promo-code";

const dict = getDict("en");

afterEach(cleanup);

const applied = (overrides: Partial<Extract<CheckoutPriceResponseDto["promo"], { status: "applied" }>> = {}): CheckoutPriceResponseDto => ({
  items: [],
  productsTotal: 90,
  promo: { status: "applied", code: "SAVE10", arName: "خصم", enName: "Save", discount: 10, saleGivenUp: 0, freeShipping: false, replacedSales: [], ...overrides }
});

const props = (overrides: Record<string, unknown> = {}) => ({
  lang: "en" as const,
  dict,
  signedIn: true,
  loginHref: "/en/login?next=%2Fen%2Fcart",
  savedCode: "",
  promo: null,
  preview: vi.fn(),
  onSave: vi.fn(),
  ...overrides
});

const typeCode = (code: string) => {
  fireEvent.change(screen.getByLabelText("Promo code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
};

describe("PromoCodeBox", () => {
  it("asks a guest to log in and keeps the code they typed", () => {
    const onSave = vi.fn();
    render(createElement(PromoCodeBox, props({ signedIn: false, onSave })));
    typeCode("save10");
    expect(onSave).toHaveBeenCalledWith("save10");
    cleanup();
    render(createElement(PromoCodeBox, props({ signedIn: false, savedCode: "save10" })));
    expect(screen.getByText("Log in to use promo codes. Your code will be kept.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/en/login?next=%2Fen%2Fcart");
  });

  it("applies a valid code straight away when it removes no sale", async () => {
    const preview = vi.fn().mockResolvedValue(applied());
    const onSave = vi.fn();
    render(createElement(PromoCodeBox, props({ preview, onSave })));
    typeCode("save10");
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("save10"));
    expect(preview).toHaveBeenCalledWith("save10");
  });

  it("explains why a code is refused and does not keep it", async () => {
    const preview = vi.fn().mockResolvedValue({ items: [], productsTotal: 100, promo: { status: "rejected", code: "NOPE", reason: "not_found" } });
    const onSave = vi.fn();
    render(createElement(PromoCodeBox, props({ preview, onSave })));
    typeCode("nope");
    expect(await screen.findByText("This code doesn't exist.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("lists the sale items the code replaces with their new price, and applies only after confirmation", async () => {
    const preview = vi.fn().mockResolvedValue(applied({ replacedSales: [{ index: 0, nameAr: "زيت", nameEn: "Hair oil", previousLineTotal: 150, lineTotal: 160 }] }));
    const onSave = vi.fn();
    render(createElement(PromoCodeBox, props({ preview, onSave })));
    typeCode("save10");

    const dialog = await screen.findByRole("dialog", { name: "Replace sale prices?" });
    expect(within(dialog).getByText(/Hair oil/)).toHaveTextContent("150");
    expect(within(dialog).getByText(/Hair oil/)).toHaveTextContent("160");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep current prices" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    typeCode("save10");
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Apply code" }));
    // The acceptance is kept with the exact prices shown, so a later price change asks again.
    expect(onSave).toHaveBeenCalledWith("save10", salesSignature([{ index: 0, nameAr: "زيت", nameEn: "Hair oil", previousLineTotal: 150, lineTotal: 160 }]));
  });

  it("asks again when re-pricing a saved code would replace a sale the customer has not accepted", () => {
    const onConfirm = vi.fn();
    const onDecline = vi.fn();
    const promo = applied({ replacedSales: [{ index: 0, nameAr: "زيت", nameEn: "Hair oil", previousLineTotal: 150, lineTotal: 160 }] }).promo;
    render(createElement(PromoCodeBox, props({ savedCode: "save10", promo, confirmation: promo, onConfirm, onDecline })));
    const dialog = screen.getByRole("dialog", { name: "Replace sale prices?" });
    expect(within(dialog).getByText("Prices changed since you applied this code. It now replaces the sale on these items:")).toBeInTheDocument();
    expect(within(dialog).getByText(/Hair oil/)).toHaveTextContent("160");
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply code" }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep current prices" }));
    expect(onDecline).toHaveBeenCalled();
  });

  it("shows an applied code with its saving and lets the customer remove it", () => {
    const onSave = vi.fn();
    render(createElement(PromoCodeBox, props({ savedCode: "save10", promo: applied().promo, onSave })));
    expect(screen.getByText("Code SAVE10 applied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("marks a saved code that no longer applies, with the reason", () => {
    render(createElement(PromoCodeBox, props({ savedCode: "save10", promo: { status: "rejected", code: "SAVE10", reason: "below_min", missingAmount: 50 } })));
    expect(screen.getByText(/Code SAVE10 no longer applies: Add .*50.* more to use this code\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("checks one code at a time, even when Enter is pressed while a check is running", async () => {
    let finish!: (value: CheckoutPriceResponseDto) => void;
    const preview = vi.fn().mockReturnValue(new Promise<CheckoutPriceResponseDto>((resolve) => { finish = resolve; }));
    render(createElement(PromoCodeBox, props({ preview })));
    typeCode("first");
    fireEvent.change(screen.getByLabelText("Promo code"), { target: { value: "second" } });
    fireEvent.keyDown(screen.getByLabelText("Promo code"), { key: "Enter" });
    expect(preview).toHaveBeenCalledTimes(1);
    finish(applied());
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument());
  });

  it("says the check failed when the code cannot be checked, and keeps nothing", async () => {
    const preview = vi.fn().mockRejectedValue(new Error("network"));
    const onSave = vi.fn();
    render(createElement(PromoCodeBox, props({ preview, onSave })));
    typeCode("save10");
    expect(await screen.findByText("We couldn't check this code. Please try again.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
