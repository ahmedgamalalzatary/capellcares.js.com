import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the storefront header", () => {
    render(<HomePage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("What are you looking for?")
    ).toBeInTheDocument();
    expect(screen.getByText("HOME")).toBeInTheDocument();
  });
});
