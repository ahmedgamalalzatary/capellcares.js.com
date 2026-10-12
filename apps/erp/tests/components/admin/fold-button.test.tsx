import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FoldButton } from "@/components/admin/fold-button";

afterEach(() => {
  cleanup();
});

describe("FoldButton", () => {
  it("is labelled and reports the expanded state to assistive tech", () => {
    render(<FoldButton collapsed={false} onClick={() => {}} label="طي القسم" />);

    const button = screen.getByRole("button", { name: "طي القسم" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("title")).toBe("طي القسم");
  });

  it("reports collapsed when the section is folded", () => {
    render(<FoldButton collapsed onClick={() => {}} label="توسيع القسم" />);

    expect(screen.getByRole("button", { name: "توسيع القسم" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<FoldButton collapsed={false} onClick={onClick} label="طي القسم" />);

    fireEvent.click(screen.getByRole("button", { name: "طي القسم" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("preserves the category toggle identity and tree appearance", () => {
    render(<FoldButton collapsed={false} onClick={() => {}} label="طي" appearance="tree" data-testid="category-toggle-2" />);

    const button = screen.getByRole("button", { name: "طي" });
    expect(button).toHaveAttribute("data-testid", "category-toggle-2");
    expect(button).toHaveClass("rounded-md", "text-text-muted");
    expect(button).not.toHaveAttribute("title");
  });
});
