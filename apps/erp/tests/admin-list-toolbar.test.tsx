import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";

describe("AdminListToolbar", () => {
  it("renders the shared search input, count label, and extra controls", () => {
    const onSearchChange = vi.fn();

    render(createElement(AdminListToolbar, {
      searchPlaceholder: "ابحثي…",
      searchValue: "rose",
      onSearchChange,
      countLabel: "3 عناصر",
      extraControls: createElement("button", { type: "button" }, "فلتر إضافي")
    }));

    expect(screen.getByDisplayValue("rose")).toBeInTheDocument();
    expect(screen.getByText("3 عناصر")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "فلتر إضافي" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("ابحثي…"), { target: { value: "serum" } });
    expect(onSearchChange).toHaveBeenCalledWith("serum");
  });
});
