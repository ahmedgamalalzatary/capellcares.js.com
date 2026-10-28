import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NavArrow } from "@/components/ui/nav-arrow";

const chevronOf = (button: HTMLElement) => button.querySelector("svg")!;

describe("NavArrow", () => {
  it("renders the brand-coloured chevron button and forwards the click", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<NavArrow direction="next" isRtl={false} aria-label="Next" onClick={onClick} />);
    const button = getByRole("button", { name: "Next" });

    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("text-brand");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("points the chevron the way it moves, mirrored for right-to-left", () => {
    const { getByRole } = render(
      <>
        <NavArrow direction="prev" isRtl={false} aria-label="ltr-prev" />
        <NavArrow direction="next" isRtl={false} aria-label="ltr-next" />
        <NavArrow direction="prev" isRtl aria-label="rtl-prev" />
        <NavArrow direction="next" isRtl aria-label="rtl-next" />
      </>
    );

    expect(chevronOf(getByRole("button", { name: "ltr-prev" })).getAttribute("class")).toContain("rotate-180");
    expect(chevronOf(getByRole("button", { name: "ltr-next" })).getAttribute("class") ?? "").not.toContain("rotate-180");
    expect(chevronOf(getByRole("button", { name: "rtl-prev" })).getAttribute("class") ?? "").not.toContain("rotate-180");
    expect(chevronOf(getByRole("button", { name: "rtl-next" })).getAttribute("class")).toContain("rotate-180");
  });

  it("is desktop-only unless told to show on every screen", () => {
    const { getByRole } = render(
      <>
        <NavArrow direction="next" isRtl={false} aria-label="desktop" />
        <NavArrow direction="next" isRtl={false} show="always" aria-label="always" />
      </>
    );

    expect(getByRole("button", { name: "desktop" }).className).toContain("hidden");
    expect(getByRole("button", { name: "desktop" }).className).toContain("lg:grid");
    expect(getByRole("button", { name: "always" }).className).not.toContain("hidden");
  });
});
