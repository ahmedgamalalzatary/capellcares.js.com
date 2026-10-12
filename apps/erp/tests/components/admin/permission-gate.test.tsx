import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn();

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/categories"
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    fetchOpenOrderReviewFlags: vi.fn().mockResolvedValue([]),
    resolveOrderReviewFlag: vi.fn()
  })
}));

import { ForbiddenPage } from "@/components/admin/permission-gate";

describe("ForbiddenPage", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Staff User", email: "staff@capella.test", role: "staff", permissionKeys: ["orders.read"] },
      hydrated: true,
      logout: vi.fn().mockResolvedValue(undefined)
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the forbidden message inside the real shell under the page title and crumbs", () => {
    render(
      <ForbiddenPage
        title="الأقسام"
        crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]}
        message="لا تملكين صلاحية الوصول إلى الأقسام."
      />
    );

    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الأقسام.")).toBeInTheDocument();
    // The real shell renders the title as the document heading and the crumbs as a trail.
    expect(screen.getByRole("heading", { name: "الأقسام" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "مسار الصفحة" });
    expect(within(nav).getByRole("link", { name: "الأقسام" })).toHaveAttribute("href", "/categories");
    expect(within(nav).getByText("غير مصرح")).toBeInTheDocument();
  });

  it("passes extra shell actions through and still shows the message", () => {
    render(
      <ForbiddenPage
        title="تفاصيل الطلب"
        crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "غير مصرح" }]}
        actions={<a href="/orders">رجوع للطلبات</a>}
        message="لا تملكين صلاحية الوصول إلى الطلبات."
      />
    );

    expect(screen.getByRole("link", { name: "رجوع للطلبات" })).toHaveAttribute("href", "/orders");
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الطلبات.")).toBeInTheDocument();
  });

  it("keeps the shell navigation limited to the permissions the signed-in staff actually has", () => {
    render(
      <ForbiddenPage title="الأقسام" crumbs={undefined} message="لا تملكين صلاحية الوصول إلى الأقسام." />
    );

    // Navigation entries are links; scoped to the shell's nav links so the page title never matches.
    const navLinks = screen.getAllByRole("link").filter((link) => !link.getAttribute("href")?.includes("/login"));
    const hrefs = navLinks.map((link) => link.getAttribute("href"));
    // Staff without categories.read gets no categories entry.
    expect(hrefs.filter((href) => href === "/categories")).toHaveLength(0);
    // But the modules they do hold are present.
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/orders");
  });
});