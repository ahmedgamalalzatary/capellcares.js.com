import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ api: { get, post: vi.fn(), put: vi.fn() } }));

import { createEmptyStaffForm, StaffEditorForm } from "@/components/admin/staff-editor-form";

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
