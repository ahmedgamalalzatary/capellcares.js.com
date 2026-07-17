import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { Footer } from "@/components/footer/Footer";

afterEach(cleanup);

describe("Footer", () => {
  it("links the shop and account columns to real storefront routes", () => {
    render(<LocaleProvider lang="en"><Footer /></LocaleProvider>);

    expect(screen.getByRole("link", { name: "All Products" })).toHaveAttribute("href", "/en/products");
    expect(screen.getByRole("link", { name: "New Arrivals" })).toHaveAttribute("href", "/en/newarrivals");
    expect(screen.getByRole("link", { name: "Best Sellers" })).toHaveAttribute("href", "/en/bestsellers");
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/en/offers");
    expect(screen.getByRole("link", { name: "Collections" })).toHaveAttribute("href", "/en/collections");
    expect(screen.getByRole("link", { name: "Your Cart" })).toHaveAttribute("href", "/en/cart");
    expect(screen.getByRole("link", { name: "Wishlist" })).toHaveAttribute("href", "/en/wishlist");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/en/login");
  });

  it("renders policies as plain text while their pages don't exist", () => {
    render(<LocaleProvider lang="en"><Footer /></LocaleProvider>);

    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Privacy Policy" })).not.toBeInTheDocument();
  });
});
