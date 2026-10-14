import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SmartPagination } from "@/components/admin/smart-pagination";

function setup(overrides: Partial<Parameters<typeof SmartPagination>[0]> = {}) {
  const props = {
    page: 1,
    more: 0,
    pageSize: 20 as const,
    total: 2500,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onLoadMore: vi.fn(),
    ...overrides
  };
  const view = render(<SmartPagination {...props} />);
  return { ...view, props, nav: () => screen.getByRole("navigation", { name: "التنقل بين الصفحات" }) };
}

const pageButtons = (nav: HTMLElement) =>
  within(nav).getAllByRole("button", { name: /^الصفحة \d+$/ }).map((button) => button.textContent);

describe("SmartPagination", () => {
  it("says where the viewer is", () => {
    setup({ page: 5 });
    expect(screen.getByRole("status")).toHaveTextContent("صفحة 5 من 125");
  });

  it("names the span of pages after load-more", () => {
    setup({ page: 5, more: 2 });
    expect(screen.getByRole("status")).toHaveTextContent("الصفحات 5–7 من 125");
  });

  it("lists first, last and nearby pages and marks the current one", () => {
    const { nav } = setup({ page: 5 });
    expect(pageButtons(nav())).toEqual(["1", "4", "5", "6", "125"]);
    expect(within(nav()).getByRole("button", { name: "الصفحة 5" })).toHaveAttribute("aria-current", "page");
  });

  it("moves to a clicked page", () => {
    const { nav, props } = setup({ page: 5 });
    fireEvent.click(within(nav()).getByRole("button", { name: "الصفحة 6" }));
    expect(props.onPageChange).toHaveBeenCalledWith(6);
  });

  it("disables السابق on the first page and التالي on the last", () => {
    setup({ page: 1 });
    expect(screen.getByRole("button", { name: "السابق" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "التالي" })).toBeEnabled();
  });

  it("moves forward past the loaded-more pages and back one page", () => {
    const { props } = setup({ page: 5, more: 2 });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(props.onPageChange).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole("button", { name: "السابق" }));
    expect(props.onPageChange).toHaveBeenCalledWith(4);
  });

  it("jumps to a typed page on Enter and keeps it in range", () => {
    const { props } = setup();
    const input = screen.getByRole("textbox", { name: "الانتقال إلى صفحة" });
    expect(input).toHaveAttribute("placeholder", "1/125");
    fireEvent.change(input, { target: { value: "40" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onPageChange).toHaveBeenLastCalledWith(40);
    fireEvent.change(input, { target: { value: "900" } });
    fireEvent.blur(input);
    expect(props.onPageChange).toHaveBeenLastCalledWith(125);
    expect(input).toHaveValue("");
  });

  it("ignores a typed value that is not a number", () => {
    const { props } = setup();
    const input = screen.getByRole("textbox", { name: "الانتقال إلى صفحة" });
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onPageChange).not.toHaveBeenCalled();
  });

  it("changes the rows per page", () => {
    const { props } = setup();
    fireEvent.change(screen.getByRole("combobox", { name: "عدد الصفوف في الصفحة" }), { target: { value: "50" } });
    expect(props.onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("loads one more page until 100 rows are on screen", () => {
    const { props, rerender } = setup();
    fireEvent.click(screen.getByRole("button", { name: "تحميل المزيد" }));
    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<SmartPagination {...props} more={4} />);
    expect(screen.queryByRole("button", { name: "تحميل المزيد" })).not.toBeInTheDocument();
    rerender(<SmartPagination {...props} pageSize={100} />);
    expect(screen.queryByRole("button", { name: "تحميل المزيد" })).not.toBeInTheDocument();
  });

  it("disables everything while loading", () => {
    setup({ page: 2, loading: true });
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "تحميل المزيد" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "عدد الصفوف في الصفحة" })).toBeDisabled();
  });

  it("hides itself when the list fits on one page", () => {
    setup({ total: 20 });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("sends a page that no longer exists to the last page", () => {
    const { props } = setup({ page: 9, total: 45 });
    expect(props.onPageChange).toHaveBeenCalledWith(3);
  });

  it("does not move while the total is still loading", () => {
    const { props } = setup({ page: 9, total: 45, loading: true });
    expect(props.onPageChange).not.toHaveBeenCalled();
  });
});
