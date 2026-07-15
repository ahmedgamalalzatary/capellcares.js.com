import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorSwatchField } from "@/components/forms/color-swatch-field";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ColorSwatchField", () => {
  it("focuses the picker and restores trigger focus when Escape closes it", async () => {
    render(<ColorSwatchField hex="#FFFFFF" label="اللون 1" onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: "اللون 1" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(trigger);
    const hue = await screen.findByRole("slider", { name: "درجة اللون" });
    await waitFor(() => expect(hue).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("uses the rendered dialog height when placing above the trigger", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("color-swatch-field")) {
        return { top: 200, bottom: 230, left: 10, right: 42, width: 32, height: 30, x: 10, y: 200, toJSON() {} };
      }
      if (this.classList.contains("color-pop")) {
        return { top: 0, bottom: 150, left: 0, right: 232, width: 232, height: 150, x: 0, y: 0, toJSON() {} };
      }
      return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} };
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 300 });

    render(<ColorSwatchField hex="#FFFFFF" label="اللون 1" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "اللون 1" }));

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveStyle({ top: "42px" }));
  });
});
