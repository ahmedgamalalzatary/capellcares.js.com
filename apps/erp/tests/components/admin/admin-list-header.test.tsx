import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminListHeader, tableSortSelect } from "@/components/admin/admin-list-header";

// The filter panel (plain labelled selects) is the phone layout; force it so the tests can drive the filters directly.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

const openPanel = () => {
  fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
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
    expect(screen.queryByRole("button", { name: /تصفية/ })).not.toBeInTheDocument();

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

    openPanel();

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

    openPanel();

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

  it("renders custom filter controls inside the filter panel", () => {
    render(createElement(AdminListHeader, {
      searchPlaceholder: "Search",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 items",
      customFilters: createElement("input", { "aria-label": "من تاريخ", type: "date" })
    }));

    openPanel();

    const dateInput = screen.getByLabelText("من تاريخ");
    expect(dateInput).toHaveAttribute("type", "date");
  });

  it("echoes an active filter as a removable chip and resets it", () => {
    const onChange = vi.fn();

    render(createElement(AdminListHeader, {
      searchPlaceholder: "ابحثي…",
      searchValue: "",
      onSearchChange: vi.fn(),
      countLabel: "3 عناصر",
      filters: [{ ...statusFilter, value: "active", onChange }]
    }));

    fireEvent.click(screen.getByLabelText("إزالة فلتر حالة العنصر"));
    expect(onChange).toHaveBeenCalledWith("all");
  });
});

const COLUMNS = [
  { key: "name", label: "المنتج" },
  { key: "price", label: "السعر" }
] as const;

describe("tableSortSelect", () => {
  it("offers 'store order' plus an ascending and a descending option per column", () => {
    const { options } = tableSortSelect(COLUMNS, null, () => {});

    expect(options).toEqual([
      { value: "", label: "ترتيب المتجر" },
      { value: "name:asc", label: "المنتج — تصاعدي" },
      { value: "name:desc", label: "المنتج — تنازلي" },
      { value: "price:asc", label: "السعر — تصاعدي" },
      { value: "price:desc", label: "السعر — تنازلي" }
    ]);
  });

  it("encodes the active sort as 'key:direction'", () => {
    const { value } = tableSortSelect(COLUMNS, { key: "price", direction: "desc" }, () => {});

    expect(value).toBe("price:desc");
  });

  it("parses a chosen option back into a sort state", () => {
    const setSort = vi.fn();
    const { onChange } = tableSortSelect(COLUMNS, null, setSort);

    onChange("price:desc");

    expect(setSort).toHaveBeenCalledWith({ key: "price", direction: "desc" });
  });

  it("maps the empty option back to the store order (null)", () => {
    const setSort = vi.fn();
    const { onChange } = tableSortSelect(COLUMNS, null, setSort);

    onChange("");

    expect(setSort).toHaveBeenCalledWith(null);
  });
});
