import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: any) => createElement("img", { alt, ...props })
}));

vi.mock("@/components/ask-capella/ask-capella-overlay", () => ({
  AskCapellaOverlay: () => createElement("div")
}));

import { AskCapellaButton } from "@/components/ask-capella/ask-capella-button";

describe("AskCapellaButton", () => {
  it("sits slightly closer to the bottom-end corner on mobile only", () => {
    render(createElement(AskCapellaButton, { lang: "en" }));

    const button = screen.getByRole("button", { name: "Ask" });
    expect(button).toHaveClass("bottom-4", "inset-e-4", "sm:bottom-6", "sm:inset-e-6");
  });
});
