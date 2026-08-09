import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntityAvatar } from "@/components/admin/entity-avatar";
import { API_BASE } from "@/lib/api/client";

describe("EntityAvatar", () => {
  // Uploads are served by the API, not by the ERP origin, so a stored
  // `/uploads/...` path has to be resolved against the API before it is shown.
  it("resolves a stored upload path against the API origin", () => {
    const { container } = render(
      createElement(EntityAvatar, { src: "/uploads/thing.webp", fallback: "T" })
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", `${API_BASE}/uploads/thing.webp`);
    expect(img).toHaveClass("avatar-tile");
    expect(container.textContent).not.toContain("T");
  });

  it("leaves an already absolute image URL alone", () => {
    const { container } = render(
      createElement(EntityAvatar, { src: "https://cdn.example.com/thing.webp", fallback: "T" })
    );

    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example.com/thing.webp");
  });

  it("leaves a non-upload relative path alone", () => {
    const { container } = render(
      createElement(EntityAvatar, { src: "/static/thing.webp", fallback: "T" })
    );

    expect(container.querySelector("img")).toHaveAttribute("src", "/static/thing.webp");
  });

  it("falls back to the first-letter avatar tile when src is missing", () => {
    const { container } = render(
      createElement(EntityAvatar, { src: null, fallback: "T" })
    );

    expect(container.querySelector("img")).toBeNull();
    const tile = container.querySelector(".avatar-tile");
    expect(tile).not.toBeNull();
    expect(tile?.textContent).toBe("T");
  });

  it("treats an empty string src as missing", () => {
    const { container } = render(
      createElement(EntityAvatar, { src: "", fallback: "X" })
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".avatar-tile")?.textContent).toBe("X");
  });

  it("applies the wide modifier to both image and fallback", () => {
    const withImage = render(
      createElement(EntityAvatar, { src: "/a.webp", fallback: "A", wide: true })
    );
    expect(withImage.container.querySelector("img")).toHaveClass("avatar-tile--wide");

    const withoutImage = render(
      createElement(EntityAvatar, { src: null, fallback: "A", wide: true })
    );
    expect(withoutImage.container.querySelector(".avatar-tile")).toHaveClass("avatar-tile--wide");
  });
});
