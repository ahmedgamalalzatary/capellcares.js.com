import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the storefront heading", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: /minikoshk storefront/i })
    ).toBeInTheDocument();
  });
});
