import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { post, get, push } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, api: { ...actual.api, post, get } };
});

import { PromoCodeForm } from "@/features/promos/components/promo-code-form";
import { buildPromoCatalog } from "@/features/promos/lib/promo-catalog";
import { createEmptyPromoForm } from "@/features/promos/lib/promo-form";

const catalog = buildPromoCatalog({
  products: [{ id: 1, name: { ar: "زيت الشعر", en: "Hair oil" }, variants: [{ id: 11, productId: 1, size: "100ml", price: 200, stock: 5 }] }] as never,
  categories: [{ id: 2, parentId: null, slug: "hair", name: { ar: "الشعر", en: "Hair" } }] as never,
  offers: [],
  collections: []
});

afterEach(() => {
  cleanup();
  post.mockReset();
  get.mockReset();
  push.mockReset();
});

const fillValidCode = () => {
  fireEvent.change(screen.getByLabelText("الكود"), { target: { value: "summer20" } });
  fireEvent.change(screen.getByLabelText("الاسم بالعربية"), { target: { value: "خصم الصيف" } });
  fireEvent.change(screen.getByLabelText("الاسم بالإنجليزية"), { target: { value: "Summer sale" } });
  fireEvent.change(screen.getByLabelText("نوع الخصم"), { target: { value: "percentage" } });
  fireEvent.change(screen.getByLabelText("نسبة الخصم (%)"), { target: { value: "20" } });
};

describe("PromoCodeForm", () => {
  it("keeps saving disabled and lists what is missing until the code is valid", () => {
    render(createElement(PromoCodeForm, { catalog }));
    const review = screen.getByRole("button", { name: "مراجعة وحفظ" });
    expect(review).toBeDisabled();
    expect(screen.getByText("اختاري ميزة واحدة على الأقل: خصم، أو توصيل مجاني، أو هدية.")).toBeInTheDocument();

    fillValidCode();
    expect(review).toBeEnabled();
  });

  it("generates a code staff can use as is", () => {
    render(createElement(PromoCodeForm, { catalog }));
    fireEvent.click(screen.getByRole("button", { name: "توليد كود" }));
    expect((screen.getByLabelText("الكود") as HTMLInputElement).value).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("asks for confirmation that the code cannot be edited, then creates it and opens it", async () => {
    post.mockResolvedValue({ id: 42 });
    render(createElement(PromoCodeForm, { catalog }));
    fillValidCode();
    fireEvent.click(screen.getByRole("button", { name: "مراجعة وحفظ" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("لا يمكن تعديل الكود بعد حفظه. لأي تغيير أنشئي كودًا جديدًا.")).toBeInTheDocument();
    expect(within(dialog).getByText("SUMMER20")).toBeInTheDocument();
    expect(within(dialog).getByText("خصم 20%")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "إنشاء الكود" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/erp/promo-codes", expect.objectContaining({ code: "SUMMER20", discountValue: 20 })));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/promo-codes/42"));
  });

  it("shows the API's reason when saving fails", async () => {
    post.mockRejectedValue(Object.assign(new Error("API 409"), { status: 409, body: { errors: ["promo.code_taken"] } }));
    render(createElement(PromoCodeForm, { catalog }));
    fillValidCode();
    fireEvent.click(screen.getByRole("button", { name: "مراجعة وحفظ" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "إنشاء الكود" }));
    expect(await screen.findByText("هذا الكود مستخدم من قبل. اختاري كودًا آخر.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("limits the code to chosen items and excludes others", async () => {
    post.mockResolvedValue({ id: 7 });
    render(createElement(PromoCodeForm, { catalog }));
    fillValidCode();
    fireEvent.click(screen.getByRole("radio", { name: "أقسام أو منتجات محددة" }));
    expect(screen.getByRole("button", { name: "مراجعة وحفظ" })).toBeDisabled();

    const include = screen.getByRole("group", { name: "يشمل" });
    fireEvent.change(within(include).getByLabelText("النوع"), { target: { value: "category" } });
    fireEvent.change(within(include).getByLabelText("العنصر"), { target: { value: "2" } });
    fireEvent.click(within(include).getByRole("button", { name: "إضافة" }));
    expect(within(include).getByText("قسم: الشعر")).toBeInTheDocument();

    const exclude = screen.getByRole("group", { name: "يستثني" });
    fireEvent.change(within(exclude).getByLabelText("النوع"), { target: { value: "variant" } });
    fireEvent.change(within(exclude).getByLabelText("العنصر"), { target: { value: "11" } });
    fireEvent.click(within(exclude).getByRole("button", { name: "إضافة" }));

    fireEvent.click(screen.getByRole("button", { name: "مراجعة وحفظ" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "إنشاء الكود" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/erp/promo-codes", expect.objectContaining({
      eligibility: { scope: "selected", include: [{ type: "category", id: 2 }], exclude: [{ type: "variant", id: 11 }] }
    })));
  });

  it("finds customers for a private code and saves only them", async () => {
    get.mockResolvedValue({ items: [{ id: 9, name: "Mona", email: "mona@example.com" }] });
    post.mockResolvedValue({ id: 8 });
    render(createElement(PromoCodeForm, { catalog }));
    fillValidCode();
    fireEvent.click(screen.getByRole("switch", { name: /كود خاص/ }));
    expect(screen.getByRole("button", { name: "مراجعة وحفظ" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("بحث عن عميل"), { target: { value: "mona" } });
    fireEvent.click(screen.getByRole("button", { name: "بحث" }));
    fireEvent.click(await screen.findByRole("button", { name: "إضافة Mona" }));
    expect(screen.getByRole("button", { name: "إزالة Mona" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/api/erp/promo-codes/customers?q=mona");

    fireEvent.click(screen.getByRole("button", { name: "مراجعة وحفظ" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "إنشاء الكود" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/erp/promo-codes", expect.objectContaining({ isPrivate: true, customerIds: [9] })));
  });

  it("starts from a duplicated code's rules when given", () => {
    render(createElement(PromoCodeForm, { catalog, initial: { ...createEmptyPromoForm(), arName: "نسخة", discountType: "fixed", discountValue: "50" } }));
    expect((screen.getByLabelText("الاسم بالعربية") as HTMLInputElement).value).toBe("نسخة");
    expect((screen.getByLabelText("قيمة الخصم (د.ك)") as HTMLInputElement).value).toBe("50");
  });
});
