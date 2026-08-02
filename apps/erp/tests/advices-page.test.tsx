import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toggleAdviceStatus = vi.fn().mockResolvedValue(undefined);
const reorderAdvices = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["advices.read", "advices.create", "advices.update", "advices.delete", "advices.toggle_status"] },
    hydrated: true,
    logout: vi.fn()
  })
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

function makeAdvice(id: number, titleAr: string, status: "active" | "inactive", sortOrder: number) {
  return {
    id,
    title: { ar: titleAr, en: id === 1 ? "Advice" : "Second" },
    description: { ar: "وصف", en: "Description" },
    videoUrl: id === 1 ? "https://instagram.com/capella" : "https://instagram.com/capella-2",
    status,
    sortOrder,
    createdAt: "",
    updatedAt: ""
  };
}

const makeMockState = () => ({
  advices: [makeAdvice(1, "نصيحة", "active", 1), makeAdvice(2, "ثانية", "active", 2)]
});

let mockState: any = makeMockState();

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(mockState),
  getStore: () => ({
    upsertAdvice: vi.fn(),
    deleteAdvice: vi.fn(),
    toggleAdviceStatus,
    reorderAdvices
  })
}));

import AdvicesPage from "@/app/advices/page";

describe("AdvicesPage", () => {
  afterEach(() => {
    cleanup();
    reorderAdvices.mockClear();
    toggleAdviceStatus.mockClear();
    mockState = makeMockState();
  });

  it("reorders advices and saves the full id order", async () => {
    render(createElement(AdvicesPage));

    fireEvent.click(screen.getAllByLabelText("تحريك لأسفل")[0]!);
    fireEvent.click(screen.getByRole("button", { name: /حفظ ترتيب النصائح/ }));

    expect(reorderAdvices).toHaveBeenCalledWith({ ids: [2, 1] });
  });

  it("hides advice reorder controls while searching", () => {
    render(createElement(AdvicesPage));

    fireEvent.change(screen.getByPlaceholderText("ابحثي عن نصيحة…"), { target: { value: "Advice" } });

    expect(screen.queryByLabelText("تحريك لأسفل")).not.toBeInTheDocument();
  });

  it("asks for confirmation before toggling advice status", async () => {
    render(createElement(AdvicesPage));

    fireEvent.click(screen.getAllByLabelText("إجراءات")[0]!);
    fireEvent.click(screen.getByTitle("إيقاف"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));

    expect(toggleAdviceStatus).toHaveBeenCalledWith(1);
  });

  it("renders the advice video URL in the list", () => {
    render(createElement(AdvicesPage));
    expect(screen.getAllByText("https://instagram.com/capella").length).toBeGreaterThan(0);
  });

  it("filters the list by advice status", () => {
    mockState = {
      advices: [makeAdvice(1, "نصيحة", "active", 1), makeAdvice(2, "ثانية", "inactive", 2)]
    };
    render(createElement(AdvicesPage));

    expect(screen.getByText("2 نصيحة")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("حالة النصيحة"), { target: { value: "inactive" } });

    expect(screen.queryByText("نصيحة")).not.toBeInTheDocument();
    expect(screen.getByText("ثانية")).toBeInTheDocument();
    expect(screen.getByText("1 نصيحة")).toBeInTheDocument();
  });

  it("hides advice reorder controls while a status filter hides part of the list", () => {
    render(createElement(AdvicesPage));

    fireEvent.change(screen.getByLabelText("حالة النصيحة"), { target: { value: "active" } });

    expect(screen.queryByLabelText("تحريك لأسفل")).not.toBeInTheDocument();
  });
});
