import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EntityMediaGallery } from "@/components/ui/entity-media-gallery";

describe("EntityMediaGallery", () => {
  it("resets the active item when the displayed entity media changes", async () => {
    const user = userEvent.setup();
    const view = render(createElement(EntityMediaGallery, {
      media: [
        { type: "image", url: "/uploads/one.jpg" },
        { type: "image", url: "/uploads/two.jpg" }
      ],
      imagePath: "/uploads/one.jpg",
      label: "First entity",
      testIdPrefix: "product",
      renderImage: (url: string) => createElement("img", { src: url, alt: "" })
    }));

    const secondThumbnail = within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")[1]!;
    await user.pointer([{ target: secondThumbnail, keys: "[MouseLeft>]" }, { target: secondThumbnail, keys: "[/MouseLeft]" }]);
    expect(secondThumbnail).toHaveAttribute("data-active", "true");

    view.rerender(createElement(EntityMediaGallery, {
      media: [{ type: "image", url: "/uploads/replacement.jpg" }],
      imagePath: "/uploads/replacement.jpg",
      label: "Replacement entity",
      testIdPrefix: "product",
      renderImage: (url: string) => createElement("img", { src: url, alt: "" })
    }));

    expect(within(screen.getByTestId("product-media-thumbs")).getByRole("button")).toHaveAttribute("data-active", "true");
  });

  it("uses pointer sequences for thumbnails without letting video controls or the thumbnail grid swipe", async () => {
    const user = userEvent.setup();
    render(createElement(EntityMediaGallery, {
      media: [
        { type: "image", url: "/uploads/one.jpg" },
        { type: "video", url: "/uploads/two.mp4" }
      ],
      imagePath: "/uploads/one.jpg",
      label: "Entity",
      testIdPrefix: "product",
      renderImage: (url: string) => createElement("img", { src: url, alt: "" })
    }));

    const thumbs = screen.getByTestId("product-media-thumbs");
    const [firstThumbnail, secondThumbnail] = within(thumbs).getAllByRole("button");
    await user.pointer([{ target: secondThumbnail!, keys: "[MouseLeft>]" }, { target: secondThumbnail!, keys: "[/MouseLeft]" }]);
    expect(secondThumbnail).toHaveAttribute("data-active", "true");

    const video = screen.getByTestId("product-media-main").querySelector("video")!;
    await user.pointer([
      { target: video, coords: { clientX: 80, clientY: 20 }, keys: "[MouseLeft>]" },
      { target: video, coords: { clientX: 220, clientY: 20 }, keys: "[/MouseLeft]" }
    ]);
    expect(secondThumbnail).toHaveAttribute("data-active", "true");

    await user.pointer([{ target: firstThumbnail!, keys: "[MouseLeft>]" }, { target: firstThumbnail!, keys: "[/MouseLeft]" }]);
    await user.pointer([
      { target: thumbs, coords: { clientX: 220, clientY: 20 }, keys: "[MouseLeft>]" },
      { target: thumbs, coords: { clientX: 80, clientY: 20 }, keys: "[/MouseLeft]" }
    ]);
    expect(firstThumbnail).toHaveAttribute("data-active", "true");
  });

  it("uses separate localized labels for dot and thumbnail controls", () => {
    render(createElement(EntityMediaGallery, {
      media: [
        { type: "image", url: "/uploads/one.jpg" },
        { type: "image", url: "/uploads/two.jpg" }
      ],
      imagePath: "/uploads/one.jpg",
      label: "Entity",
      testIdPrefix: "product",
      dotLabelTemplate: "وسائط {index}",
      thumbnailLabelTemplate: "اختر الوسائط {index}",
      renderImage: (url: string) => createElement("img", { src: url, alt: "" })
    }));

    expect(within(screen.getByTestId("product-media-dots")).getByRole("button", { name: "وسائط 2" })).toBeInTheDocument();
    expect(within(screen.getByTestId("product-media-thumbs")).getByRole("button", { name: "اختر الوسائط 2" })).toBeInTheDocument();
  });
});
