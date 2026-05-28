import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/sales"
}));

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => ({
    user: { name: "Admin User", email: "admin@capella.test" },
    hydrated: true,
    logout: vi.fn().mockResolvedValue(undefined)
  })
}));

import { AdminShell } from "@/components/shell/admin-shell";

describe("AdminShell", () => {
  it("includes a visible sales navigation item", () => {
    render(createElement(AdminShell, { title: "اختبار", children: createElement("div", null, "content") }));

    const salesLinks = screen.getAllByText("المبيعات");
    expect(salesLinks.length).toBeGreaterThan(0);
  });
});
