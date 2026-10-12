import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ api: { get, post, put } }));

import { StaffEditorForm } from "@/features/staff/components/staff-editor-form";
import { createEmptyStaffForm } from "@/features/staff/lib/staff-form-state";

// The API sends a dependencies array on every permission (the ERP controller defaults it to []),
// so a missing one means a malformed catalog.
const catalog = [
  { key: "orders.read", module: "orders", dependencies: [] },
  { key: "orders.update", module: "orders", dependencies: ["orders.read"] },
  { key: "orders.permanent_delete", module: "orders", dependencies: ["orders.update"] },
  { key: "products.read", module: "products", dependencies: [] }
];

const baseValues = {
  name: "سارة",
  email: "sara@capella.test",
  password: "",
  isActive: true,
  permissionKeys: ["orders.read"]
};

async function renderForm(props: Record<string, unknown> = {}) {
  render(createElement(StaffEditorForm, {
    mode: "create",
    initialValues: baseValues,
    ...props
  } as any));
  await screen.findByRole("checkbox", { name: "الطلبات / عرض" });
}

describe("StaffEditorForm review permissions", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ items: [{ key: "reviews.read", dependencies: [] }] });
  });

  it("shows the Arabic Reviews module label instead of the raw key", async () => {
    render(createElement(StaffEditorForm, { mode: "create", initialValues: createEmptyStaffForm() }));

    expect(await screen.findByText("التقييمات")).toBeInTheDocument();
    expect(screen.queryByText(/^reviews$/)).not.toBeInTheDocument();
  });
});

describe("StaffEditorForm saving", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ items: catalog });
    post.mockReset().mockResolvedValue(undefined);
    put.mockReset().mockResolvedValue(undefined);
  });

  it("creates a member with the seeded permissions and an empty password", async () => {
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/erp/staff", {
      name: "سارة",
      email: "sara@capella.test",
      password: "",
      isActive: true,
      permissionKeys: ["orders.read"]
    }));
  });

  it("updates the seeded member at its own id rather than creating another", async () => {
    await renderForm({ mode: "edit", staffId: 12 });

    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/api/erp/staff/12", expect.objectContaining({
      name: "سارة",
      email: "sara@capella.test"
    })));
    expect(post).not.toHaveBeenCalled();
  });

  it("adds the permissions a ticked one depends on", async () => {
    await renderForm();

    // permanent_delete depends on update, which itself depends on read.
    fireEvent.click(screen.getByRole("checkbox", { name: "الطلبات / حذف نهائي" }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].permissionKeys.sort()).toEqual([
      "orders.permanent_delete",
      "orders.read",
      "orders.update"
    ]);
  });

  it("unticking a permission removes it from the form but a dependent key restores it on save", async () => {
    await renderForm({
      initialValues: { ...baseValues, permissionKeys: ["orders.permanent_delete", "orders.read", "orders.update"] }
    });

    // Unticking only edits the form state; the remaining keys still depend on read.
    fireEvent.click(screen.getByRole("checkbox", { name: "الطلبات / عرض" }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    // Normalization on save pulls orders.read back in, because orders.update still depends on it.
    expect(post.mock.calls[0][1].permissionKeys).toEqual([
      "orders.permanent_delete",
      "orders.read",
      "orders.update"
    ]);
  });

  it("drops a permission for good once nothing else depends on it", async () => {
    await renderForm({ initialValues: { ...baseValues, permissionKeys: ["orders.read", "products.read"] } });

    fireEvent.click(screen.getByRole("checkbox", { name: "الطلبات / عرض" }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].permissionKeys).toEqual(["products.read"]);
  });

  it("carries an unrelated permission through untouched", async () => {
    await renderForm({ initialValues: { ...baseValues, permissionKeys: ["products.read"] } });

    fireEvent.click(screen.getByRole("checkbox", { name: "الطلبات / تعديل" }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].permissionKeys).toEqual(["orders.read", "orders.update", "products.read"]);
  });

  it("sends an inactive member as inactive", async () => {
    await renderForm();

    fireEvent.click(screen.getByRole("switch", { name: /الحساب نشط/ }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1].isActive).toBe(false);
  });

  it("still saves when the permission catalog carries malformed dependencies", async () => {
    get.mockResolvedValue({
      items: [{ key: "orders.read", module: "orders" }, { key: "products.read", module: "products" }]
    });
    await renderForm({ initialValues: { ...baseValues, permissionKeys: [] } });

    fireEvent.click(screen.getByRole("checkbox", { name: "الطلبات / عرض" }));
    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    // No dependency expansion happens here: the parser bailed out and left the map empty.
    expect(post.mock.calls[0][1].permissionKeys).toEqual(["orders.read"]);
  });

  it("reports the server's message and keeps the form usable when saving fails", async () => {
    post.mockRejectedValue(
      Object.assign(new Error("API 409"), { status: 409, body: { message: "البريد مستخدم بالفعل" } })
    );
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));

    expect(await screen.findByText("البريد مستخدم بالفعل")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنشاء العضو" })).toBeEnabled();
    expect(screen.getByLabelText("الاسم")).toHaveValue("سارة");
  });

  it("clears the form after a successful create so a second member can be added", async () => {
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "إنشاء العضو" }));
    await waitFor(() => expect(post).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByLabelText("الاسم")).toHaveValue(""));
    expect(screen.getByLabelText("البريد الإلكتروني")).toHaveValue("");
  });

  it("runs onSuccess after an edit is saved", async () => {
    const onSuccess = vi.fn();
    await renderForm({ mode: "edit", staffId: 12, onSuccess });

    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});