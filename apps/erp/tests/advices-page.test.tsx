import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  loaded: true,
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

beforeEach(() => {
  // The filter panel (plain labelled selects) is the phone layout; force it so the tests can drive the filters.
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

describe("AdvicesPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    reorderAdvices.mockClear();
    toggleAdviceStatus.mockClear();
    mockState = makeMockState();
  });

  const openPanel = () => {
    fireEvent.click(screen.getByRole("button", { name: /تصفية/ }));
  };

  it("reorders advices and saves the full id order", async () => {
    render(createElement(AdvicesPage));

    fireEvent.click(screen.getAllByLabelText("تحريك لأسفل")[0]!);
    fireEvent.click(screen.getByRole("button", { name: /حفظ ترتيب النصائح/ }));

    expect(reorderAdvices).toHaveBeenCalledWith({ ids: [2, 1] });
  });

  it("hides advice reorder controls while searching", () => {
    render(createElement(AdvicesPage));

    fireEvent.change(screen.getByPlaceholderText("ابحثي باسم النصيحة…"), { target: { value: "Advice" } });

    expect(screen.queryByLabelText("تحريك لأسفل")).not.toBeInTheDocument();
  });

  it("asks for confirmation before toggling advice status", async () => {
    render(createElement(AdvicesPage));

    fireEvent.pointerDown(screen.getByRole("button", { name: "إجراءات نصيحة" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "إيقاف" }));

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
      loaded: true,
      advices: [makeAdvice(1, "نصيحة", "active", 1), makeAdvice(2, "ثانية", "inactive", 2)]
    };
    render(createElement(AdvicesPage));

    expect(screen.getByText("2 نصيحة")).toBeInTheDocument();

    openPanel();
    fireEvent.change(screen.getByLabelText("الحالة"), { target: { value: "inactive" } });

    expect(screen.queryByText("نصيحة")).not.toBeInTheDocument();
    expect(screen.getByText("ثانية")).toBeInTheDocument();
    expect(screen.getByText("1 نصيحة")).toBeInTheDocument();
  });

  it("hides advice reorder controls while a status filter hides part of the list", () => {
    render(createElement(AdvicesPage));

    openPanel();
    fireEvent.change(screen.getByLabelText("الحالة"), { target: { value: "active" } });

    expect(screen.queryByLabelText("تحريك لأسفل")).not.toBeInTheDocument();
  });
});
