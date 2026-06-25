import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toggleAdviceStatus = vi.fn().mockResolvedValue(undefined);

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

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector({
    advices: [{
      id: 1,
      title: { ar: "نصيحة", en: "Advice" },
      description: { ar: "وصف", en: "Description" },
      videoUrl: "https://instagram.com/capella",
      status: "active",
      sortOrder: 1,
      createdAt: "",
      updatedAt: ""
    }]
  }),
  getStore: () => ({
    upsertAdvice: vi.fn(),
    deleteAdvice: vi.fn(),
    toggleAdviceStatus
  })
}));

import AdvicesPage from "@/app/advices/page";

describe("AdvicesPage", () => {
  it("asks for confirmation before toggling advice status", async () => {
    render(createElement(AdvicesPage));

    fireEvent.click(screen.getByLabelText("إجراءات"));
    fireEvent.click(screen.getByTitle("إيقاف"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));

    expect(toggleAdviceStatus).toHaveBeenCalledWith(1);
  });

  it("renders the advice video URL in the list", () => {
    render(createElement(AdvicesPage));
    expect(screen.getAllByText("https://instagram.com/capella").length).toBeGreaterThan(0);
  });
});
