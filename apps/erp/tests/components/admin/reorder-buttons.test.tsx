import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReorderButtons } from "@/components/admin/reorder-buttons";

afterEach(cleanup);

describe("ReorderButtons", () => {
  it("renders the Arabic move buttons", () => {
    render(<ReorderButtons index={1} count={3} onMove={vi.fn()} />);

    expect(screen.getByRole("button", { name: "تحريك لأعلى" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تحريك لأسفل" })).toBeInTheDocument();
  });

  it("disables the up button on the first row and the down button on the last", () => {
    const { rerender } = render(<ReorderButtons index={0} count={3} onMove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "تحريك لأعلى" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "تحريك لأسفل" })).not.toBeDisabled();

    rerender(<ReorderButtons index={2} count={3} onMove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "تحريك لأعلى" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "تحريك لأسفل" })).toBeDisabled();
  });

  it("calls onMove with the index and direction", () => {
    const onMove = vi.fn();
    render(<ReorderButtons index={1} count={3} onMove={onMove} />);

    fireEvent.click(screen.getByRole("button", { name: "تحريك لأعلى" }));
    fireEvent.click(screen.getByRole("button", { name: "تحريك لأسفل" }));

    expect(onMove).toHaveBeenNthCalledWith(1, 1, -1);
    expect(onMove).toHaveBeenNthCalledWith(2, 1, 1);
  });

  it("stacks the buttons when orientation is column", () => {
    const { container } = render(<ReorderButtons index={1} count={3} onMove={vi.fn()} orientation="column" />);

    expect(container.firstElementChild).toHaveClass("flex-col");
  });

  it("respects the disabled prop", () => {
    render(<ReorderButtons index={1} count={3} onMove={vi.fn()} disabled />);

    expect(screen.getByRole("button", { name: "تحريك لأعلى" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "تحريك لأسفل" })).toBeDisabled();
  });
});
