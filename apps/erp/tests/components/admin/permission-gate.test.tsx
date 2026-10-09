import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let shellProps: { title?: string; crumbs?: unknown; actions?: React.ReactNode } = {};

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ title, crumbs, actions, children }: { title?: string; crumbs?: unknown; actions?: React.ReactNode; children?: React.ReactNode }) => {
    shellProps = { title, crumbs, actions };
    return createElement("div", { "data-testid": "shell" }, actions as never, children);
  }
}));

import { ForbiddenPage } from "@/components/admin/permission-gate";

afterEach(() => {
  cleanup();
  shellProps = {};
});

describe("ForbiddenPage", () => {
  it("shows the forbidden message inside the shell with the page title and crumbs", () => {
    render(
      <ForbiddenPage
        title="الأقسام"
        crumbs={[{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]}
        message="لا تملكين صلاحية الوصول إلى الأقسام."
      />
    );

    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الأقسام.")).toBeTruthy();
    expect(shellProps.title).toBe("الأقسام");
    expect(shellProps.crumbs).toEqual([{ label: "الأقسام", href: "/categories" }, { label: "غير مصرح" }]);
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

    expect(shellProps.actions).toBeTruthy();
    expect(screen.getByText("رجوع للطلبات")).toBeTruthy();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى الطلبات.")).toBeTruthy();
  });
});
