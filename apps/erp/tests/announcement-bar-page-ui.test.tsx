import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeActions = {
  fetchAnnouncementBar: vi.fn().mockResolvedValue(undefined),
  setAnnouncementBarEnabled: vi.fn().mockResolvedValue(undefined),
  createAnnouncementItem: vi.fn().mockResolvedValue(undefined),
  updateAnnouncementItem: vi.fn().mockResolvedValue(undefined),
  deleteAnnouncementItem: vi.fn().mockResolvedValue(undefined),
  reorderAnnouncementItems: vi.fn().mockResolvedValue(undefined)
};

const storeState = {
  announcementBarWarning: null as string | null,
  announcementBar: {
    enabled: true,
    items: [
      { id: 1, text: { ar: "الأول", en: "First" }, isActive: true, sortOrder: 0 },
      { id: 2, text: { ar: "الثاني", en: "Second" }, isActive: false, sortOrder: 1 }
    ]
  }
};

const mockedUseAdminAuth = vi.fn(() => ({
  user: {
    name: "Admin User",
    email: "admin@minikoshk.test",
    role: "admin",
    permissionKeys: ["announcement_bar.read", "announcement_bar.update"]
  },
  hydrated: true,
  logout: vi.fn()
}));

vi.mock("@/components/providers/admin-auth", () => ({ useAdminAuth: () => mockedUseAdminAuth() }));
vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => createElement("div", null, children)
}));
vi.mock("@/lib/store", () => ({
  useStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
  getStore: () => storeActions
}));

import AnnouncementBarPage from "@/app/announcement-bar/page";

beforeEach(() => {
  storeState.announcementBarWarning = null;
  Object.values(storeActions).forEach((action) => action.mockClear());
  mockedUseAdminAuth.mockReturnValue({
    user: {
      name: "Admin User",
      email: "admin@minikoshk.test",
      role: "admin",
      permissionKeys: ["announcement_bar.read", "announcement_bar.update"]
    },
    hydrated: true,
    logout: vi.fn()
  });
});

afterEach(cleanup);

describe("AnnouncementBarPage", () => {
  it("loads and displays the announcement configuration", () => {
    render(createElement(AnnouncementBarPage));

    expect(screen.getByRole("heading", { name: "شريط الإعلانات" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("First")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Second")).toBeInTheDocument();
    expect(storeActions.fetchAnnouncementBar).toHaveBeenCalled();
  });

  it("updates visibility and supports item creation and management", async () => {
    render(createElement(AnnouncementBarPage));

    fireEvent.click(screen.getByRole("checkbox", { name: "عرض شريط الإعلانات" }));
    await waitFor(() => expect(storeActions.setAnnouncementBarEnabled).toHaveBeenCalledWith(false));

    fireEvent.change(screen.getByLabelText("النص العربي الجديد"), { target: { value: "جديد" } });
    fireEvent.change(screen.getByLabelText("النص الإنجليزي الجديد"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة إعلان" }));
    await waitFor(() => expect(storeActions.createAnnouncementItem).toHaveBeenCalledWith({ ar: "جديد", en: "New" }));

    fireEvent.click(screen.getByRole("button", { name: "تعطيل First" }));
    await waitFor(() => expect(storeActions.updateAnnouncementItem).toHaveBeenCalledWith(1, { isActive: false }));

    fireEvent.change(screen.getByLabelText("النص الإنجليزي للإعلان First"), { target: { value: "First updated" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ First" }));
    await waitFor(() => expect(storeActions.updateAnnouncementItem).toHaveBeenCalledWith(1, {
      text: { ar: "الأول", en: "First updated" }
    }));

    fireEvent.click(screen.getByRole("button", { name: "تحريك First لأسفل" }));
    await waitFor(() => expect(storeActions.reorderAnnouncementItems).toHaveBeenCalledWith([2, 1]));

    fireEvent.click(screen.getByRole("button", { name: "حذف Second" }));
    expect(storeActions.deleteAnnouncementItem).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("dialog");
    expect(confirmation).toBeInTheDocument();
    fireEvent.click(confirmation.querySelector(".btn--danger")!);
    await waitFor(() => expect(storeActions.deleteAnnouncementItem).toHaveBeenCalledWith(2));
  });

  it("shows a non-failing warning when storefront refresh is delayed", () => {
    storeState.announcementBarWarning = "Changes were saved, but the storefront refresh is delayed.";

    render(createElement(AnnouncementBarPage));

    expect(screen.getByRole("status")).toHaveTextContent(/storefront refresh is delayed/i);
  });

  it("shows a forbidden state without read permission", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff", email: "staff@minikoshk.test", role: "staff", permissionKeys: [] },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(AnnouncementBarPage));
    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
  });
});
