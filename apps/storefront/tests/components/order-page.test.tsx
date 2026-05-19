import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderPage from "@/app/[lang]/orders/[id]/page";

const notFound = vi.fn(() => {
  throw new Error("notFound");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFound()
}));

vi.mock("@capella/shared", () => ({
  getDict: () => ({
    common: { breadcrumbHome: "Home" },
    orders: { title: "Orders", orderCode: "Order code" }
  }),
  languages: ["en", "ar"]
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: () => createElement("nav", {}, "breadcrumb")
}));

vi.mock("@/components/orders/order-detail-view", () => ({
  OrderDetailView: ({ orderId }: { orderId: number }) => createElement("div", {}, `detail-${orderId}`)
}));

describe("OrderPage", () => {
  it("does not render the numeric route id as a page heading", async () => {
    const view = await OrderPage({ params: Promise.resolve({ lang: "en", id: "5" }) });

    render(view);

    expect(screen.getByText("detail-5")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "5" })).not.toBeInTheDocument();
    expect(screen.queryByText("Order code")).not.toBeInTheDocument();
  });
});
