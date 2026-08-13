import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminListHeader } from "@/components/admin/admin-list-header";

afterEach(() => {
  cleanup();
});

const statusFilter = {
  key: "status",
  label: "حالة العنصر",
  value: "all",
  onChange: vi.fn(),
  options: [
    { value: "all", label: "كل الحالات" },
    { value: "active", label: "نشط" },
    { value: "inactive", label: "غير نشط" }
  ]
};

describe("AdminListHeader", () => {
  it("renders the search input and count label with no filters", () => {
    const onSearchChange = vi.fn();

    render(createElement(AdminListHeader, {
      searchPlaceholder: "ابحثي…",
      searchValue: "rose",
      onSearchChange,
      countLabel: "3 عناصر"
    }));

    expect(screen.getByDisplayValue("rose")).toBeInTheDocument();
    expect(screen.getByText("3 عناصر")).toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);

    fireEvent.change(screen.getByPlaceholderText("ابحثي…"), { target: { value: "serum" } });
    expect(onSearchChange).toHaveBeenCalledWith("serum");
  });

  it("labels each filter and reports the selected value back as a string", () => {
    const onChange = vi.fn();

    render(createElement(AdminListHeader, {
      searchPlaceholder: "ابحثي…",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 عناصر",
      filters: [{ ...statusFilter, onChange }]
    }));

    const select = screen.getByLabelText("حالة العنصر") as HTMLSelectElement;
    expect(select).toHaveValue("all");
    expect(Array.from(select.querySelectorAll("option")).map((option) => option.textContent))
      .toEqual(["كل الحالات", "نشط", "غير نشط"]);

    fireEvent.change(select, { target: { value: "inactive" } });
    expect(onChange).toHaveBeenCalledWith("inactive");
  });

  it("renders every filter it is given, in order", () => {
    render(createElement(AdminListHeader, {
      searchPlaceholder: "ابحثي…",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 عناصر",
      filters: [
        statusFilter,
        { key: "type", label: "نوع العنصر", value: "", onChange: vi.fn(), options: [{ value: "", label: "كل الأنواع" }] },
        { key: "category", label: "القسم", value: "", onChange: vi.fn(), options: [{ value: "", label: "كل الأقسام" }] }
      ]
    }));

    const labels = screen.getAllByRole("combobox").map((select) => select.getAttribute("aria-label"));
    expect(labels).toEqual(["حالة العنصر", "نوع العنصر", "القسم"]);
  });

  it("names the search input after its placeholder unless the page overrides it", () => {
    const { rerender } = render(createElement(AdminListHeader, {
      searchPlaceholder: "ابحثي…",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 عناصر"
    }));

    expect(screen.getByLabelText("ابحثي…")).toBeInTheDocument();

    rerender(createElement(AdminListHeader, {
      searchPlaceholder: "ابحثي…",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 عناصر",
      searchLabel: "البحث في التقييمات"
    }));

    expect(screen.getByLabelText("البحث في التقييمات")).toBeInTheDocument();
  });

  it("renders custom filter controls in the shared filter group", () => {
    render(createElement(AdminListHeader, {
      searchPlaceholder: "Search",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 items",
      customFilters: createElement("input", { "aria-label": "من تاريخ", type: "date" })
    }));

    const dateInput = screen.getByLabelText("من تاريخ");
    expect(dateInput).toHaveAttribute("type", "date");
    expect(dateInput.parentElement).toHaveClass("list-header__filters");
  });

  it("styles filters with the shared select class so pages cannot drift", () => {
    render(createElement(AdminListHeader, {
      searchPlaceholder: "ابحثي…",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 عناصر",
      filters: [statusFilter]
    }));

    expect(screen.getByLabelText("حالة العنصر")).toHaveClass("select");
  });
});
