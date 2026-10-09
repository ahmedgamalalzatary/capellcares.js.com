import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/admin/status-badge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("shows the active label", () => {
    render(<StatusBadge active />);
    expect(screen.getByText("نشط")).toBeInTheDocument();
  });

  it("shows the inactive label", () => {
    render(<StatusBadge active={false} />);
    expect(screen.getByText("غير نشط")).toBeInTheDocument();
  });
});
