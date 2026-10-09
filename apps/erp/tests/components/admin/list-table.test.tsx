import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableEmptyRow, TableSkeletonRows, tableSortSelect } from "@/components/admin/list-table";

afterEach(() => {
  cleanup();
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

describe("TableEmptyRow", () => {
  it("spans the row across the table and shows the message", () => {
    render(
      <table>
        <tbody>
          <TableEmptyRow colSpan={6} icon={<span data-testid="icon" />} title="لا توجد منتجات" description="جرّبي كلمة أخرى" />
        </tbody>
      </table>
    );

    expect(screen.getByText("لا توجد منتجات")).toBeTruthy();
    expect(screen.getByText("جرّبي كلمة أخرى")).toBeTruthy();
    expect(document.querySelector("td")?.getAttribute("colspan")).toBe("6");
  });

  it("renders an optional action under the message", () => {
    render(
      <table>
        <tbody>
          <TableEmptyRow colSpan={5} title="لا يوجد أعضاء" action={<a href="/staff/new">إضافة عضو</a>} />
        </tbody>
      </table>
    );

    expect(screen.getByText("إضافة عضو")).toBeTruthy();
  });

  it("marks a danger row as an alert", () => {
    render(
      <table>
        <tbody>
          <TableEmptyRow colSpan={8} tone="danger" title="تعذر تحميل التقييمات" />
        </tbody>
      </table>
    );

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("TableSkeletonRows", () => {
  it("repeats one row's cells the requested number of times, hidden from assistive tech", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeletonRows
            rows={3}
            cells={[<td key="a" />, <td key="b" />]}
          />
        </tbody>
      </table>
    );

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row.getAttribute("aria-hidden")).toBe("true");
      expect(row.querySelectorAll("td")).toHaveLength(2);
    });
  });

  it("defaults to five rows", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeletonRows cells={[<td key="a" />]} />
        </tbody>
      </table>
    );

    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
  });
});
