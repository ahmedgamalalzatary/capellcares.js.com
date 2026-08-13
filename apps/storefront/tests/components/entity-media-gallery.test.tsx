import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityMediaGallery } from "@/components/ui/entity-media-gallery";

describe("EntityMediaGallery", () => {
  it("resets the active item when the displayed entity media changes", async () => {
    const user = userEvent.setup();
    const view = render(createElement(EntityMediaGallery, {
      media: [
        { type: "image", arUrl: null, enUrl: "/uploads/one.jpg" },
        { type: "image", arUrl: null, enUrl: "/uploads/two.jpg" }
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
      media: [{ type: "image", arUrl: null, enUrl: "/uploads/replacement.jpg" }],
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
        { type: "image", arUrl: null, enUrl: "/uploads/one.jpg" },
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
        { type: "image", arUrl: null, enUrl: "/uploads/one.jpg" },
        { type: "image", arUrl: null, enUrl: "/uploads/two.jpg" }
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

  const imageMedia = [
    { type: "image" as const, arUrl: null, enUrl: "/uploads/one.jpg" },
    { type: "image" as const, arUrl: null, enUrl: "/uploads/two.jpg" }
  ];

  const renderImage = (url: string) => createElement("img", { src: url, alt: "" });

  it("selects the requested image language with opposite-language fallback", () => {
    render(createElement(EntityMediaGallery, {
      media: [
        { type: "image", arUrl: "/uploads/ar.jpg", enUrl: "/uploads/en.jpg" },
        { type: "image", arUrl: null, enUrl: "/uploads/fallback-en.jpg" }
      ],
      lang: "ar",
      imagePath: "/uploads/en.jpg",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    const images = [...document.querySelectorAll("img")];
    expect(images.some((image) => image.getAttribute("src") === "/uploads/ar.jpg")).toBe(true);
    expect(images.some((image) => image.getAttribute("src") === "/uploads/fallback-en.jpg")).toBe(true);
    expect(images.some((image) => image.getAttribute("src") === "/uploads/en.jpg")).toBe(false);
  });

  it("adds a linked video as the last item, after every image", () => {
    render(createElement(EntityMediaGallery, {
      media: imageMedia,
      imagePath: "/uploads/one.jpg",
      videoUrl: "https://www.youtube.com/watch?v=capella",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    const thumbnails = within(screen.getByTestId("product-media-thumbs")).getAllByRole("button");
    expect(thumbnails).toHaveLength(3);
    // The photos still lead; the video is the final thumbnail. Its image is
    // decorative — the button itself carries the label — so query the tag.
    expect(thumbnails[2]!.querySelector("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/capella/sddefault.jpg"
    );
  });

  it("keeps the first image showing until the video thumbnail is chosen", async () => {
    const user = userEvent.setup();
    render(createElement(EntityMediaGallery, {
      media: imageMedia,
      imagePath: "/uploads/one.jpg",
      videoUrl: "https://www.youtube.com/watch?v=capella",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    const main = screen.getByTestId("product-media-main");
    expect(main.querySelector("iframe")).toBeNull();

    const videoThumbnail = within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")[2]!;
    await user.pointer([{ target: videoThumbnail, keys: "[MouseLeft>]" }, { target: videoThumbnail, keys: "[/MouseLeft]" }]);

    const frame = screen.getByTestId("product-media-main").querySelector("iframe");
    expect(frame).toHaveAttribute("src", expect.stringContaining("https://www.youtube.com/embed/capella?"));
    expect(frame).toHaveAttribute("src", expect.stringContaining("controls=1"));
    // A gallery must never start playing on its own — selecting the thumbnail
    // only reveals the player, the shopper still has to press play.
    expect(frame?.getAttribute("src")).not.toContain("autoplay");
    expect(frame).not.toHaveAttribute("allow", expect.stringContaining("autoplay"));
  });

  it("embeds a linked Instagram post rather than dropping it", async () => {
    const user = userEvent.setup();
    render(createElement(EntityMediaGallery, {
      media: imageMedia,
      imagePath: "/uploads/one.jpg",
      videoUrl: "https://www.instagram.com/reel/DZfXbijzAD6/",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    const videoThumbnail = within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")[2]!;
    await user.pointer([{ target: videoThumbnail, keys: "[MouseLeft>]" }, { target: videoThumbnail, keys: "[/MouseLeft]" }]);

    expect(
      screen.getByTestId("product-media-main").querySelector("blockquote.instagram-media")
    ).toHaveAttribute("data-instgrm-permalink", "https://www.instagram.com/reel/DZfXbijzAD6/");
  });

  it("ignores a link it cannot turn into a player", () => {
    render(createElement(EntityMediaGallery, {
      media: imageMedia,
      imagePath: "/uploads/one.jpg",
      videoUrl: "https://example.com/whatever",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    expect(within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")).toHaveLength(2);
  });

  // A second finger lifting used to reach clearPointer before the isPrimary
  // guard, wiping the drag state and silently killing the first finger's swipe.
  it("lets a swipe survive a second finger lifting mid-gesture", () => {
    render(createElement(EntityMediaGallery, {
      media: imageMedia,
      imagePath: "/uploads/one.jpg",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    const main = screen.getByTestId("product-media-main");
    const releasePointerCapture = vi.fn();
    Object.assign(main, {
      setPointerCapture: vi.fn(),
      releasePointerCapture,
      hasPointerCapture: vi.fn((pointerId: number) => pointerId === 1)
    });
    const thumbnails = () => within(screen.getByTestId("product-media-thumbs")).getAllByRole("button");

    fireEvent.pointerDown(main, { clientX: 260, clientY: 100, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true });
    fireEvent.pointerUp(document, { clientX: 60, clientY: 105, pointerId: 2, pointerType: "touch", button: 0, isPrimary: false });

    expect(releasePointerCapture).not.toHaveBeenCalledWith(2);
    expect(thumbnails()[0]).toHaveAttribute("data-active", "true");

    fireEvent.pointerUp(document, { clientX: 60, clientY: 105, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true });

    expect(thumbnails()[1]).toHaveAttribute("data-active", "true");
  });

  it("ignores a stray pointercancel from another pointer", () => {
    render(createElement(EntityMediaGallery, {
      media: imageMedia,
      imagePath: "/uploads/one.jpg",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    const main = screen.getByTestId("product-media-main");
    Object.assign(main, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn((pointerId: number) => pointerId === 1)
    });
    const thumbnails = () => within(screen.getByTestId("product-media-thumbs")).getAllByRole("button");

    fireEvent.pointerDown(main, { clientX: 260, clientY: 100, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true });
    fireEvent.pointerCancel(document, { pointerId: 2, pointerType: "touch", isPrimary: false });
    fireEvent.pointerUp(document, { clientX: 60, clientY: 105, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true });

    expect(thumbnails()[1]).toHaveAttribute("data-active", "true");
  });

  it("is unchanged when no video link is supplied", () => {
    render(createElement(EntityMediaGallery, {
      media: imageMedia,
      imagePath: "/uploads/one.jpg",
      label: "Entity",
      testIdPrefix: "product",
      renderImage
    }));

    expect(within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByTestId("product-media-main").querySelector("iframe")).toBeNull();
  });
});
