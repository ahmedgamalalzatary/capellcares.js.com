import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  describe("media lightbox", () => {
    const openLightbox = async (user: ReturnType<typeof userEvent.setup>, props: Record<string, unknown> = {}) => {
      render(createElement(EntityMediaGallery, {
        media: imageMedia,
        imagePath: "/uploads/one.jpg",
        label: "Rose Serum",
        testIdPrefix: "product",
        renderImage,
        ...props
      } as any));
      // Opened the way a shopper does — the control's label is localized.
      await user.click(screen.getByTestId("product-media-main"));
      return screen.getByRole("dialog");
    };

    it("opens when the media itself is clicked, which is how touch shoppers reach it", async () => {
      const user = userEvent.setup();
      render(createElement(EntityMediaGallery, {
        media: imageMedia,
        imagePath: "/uploads/one.jpg",
        label: "Rose Serum",
        testIdPrefix: "product",
        renderImage
      }));

      // Nothing is open until it is asked for.
      expect(screen.queryByRole("dialog")).toBeNull();

      await user.click(screen.getByTestId("product-media-main"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("marks the media with the plus cursor instead of floating a plus button over it", () => {
      render(createElement(EntityMediaGallery, {
        media: imageMedia,
        imagePath: "/uploads/one.jpg",
        label: "Rose Serum",
        testIdPrefix: "product",
        renderImage
      }));

      expect(screen.getByTestId("product-media-main").className).toContain("cursor-plus");
      // The old floating chip is gone; the keyboard control stays, unobtrusively.
      expect(screen.queryByTestId("product-media-expand")).toBeNull();
      expect(screen.getByRole("button", { name: "View all media" }).className).toContain("sr-only");
    });

    it("does not open on the swipe that changes the image", () => {
      render(createElement(EntityMediaGallery, {
        media: imageMedia,
        imagePath: "/uploads/one.jpg",
        label: "Rose Serum",
        testIdPrefix: "product",
        renderImage
      }));

      const main = screen.getByTestId("product-media-main");
      Object.assign(main, {
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: vi.fn(() => true)
      });

      fireEvent.pointerDown(main, { clientX: 260, clientY: 100, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true });
      fireEvent.pointerUp(main, { clientX: 60, clientY: 105, pointerId: 1, pointerType: "touch", button: 0, isPrimary: true });
      fireEvent.click(main);

      // The swipe moved the gallery on; it must not also throw the dialog open.
      expect(within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")[1])
        .toHaveAttribute("data-active", "true");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders outside the page markup so nothing on the page can show through it", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      // A portal to <body>: inside the page tree, an ancestor's stacking context
      // let page content (price, share, tabs) paint over the dialog.
      expect(dialog.parentElement).toBe(document.body);
    });

    it("keeps the whole picture inside the stage instead of cropping it", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      const stage = within(dialog).getByTestId("product-lightbox-main");
      // Whatever each detail page renders, it is bounded by the stage box.
      expect(stage.className).toContain("[&_img]:max-h-full");
      expect(stage.className).toContain("[&_img]:object-contain");
      expect(stage.className).toContain("[&_svg]:max-h-full");
    });

    it("opens a dialog titled with the entity, showing the media it was opened on", async () => {
      const user = userEvent.setup();

      render(createElement(EntityMediaGallery, {
        media: imageMedia,
        imagePath: "/uploads/one.jpg",
        label: "Rose Serum",
        testIdPrefix: "product",
        renderImage
      }));

      // Move the page gallery to the second image first: the dialog must open
      // where the shopper already is, not jump back to the first item.
      const secondThumbnail = within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")[1]!;
      await user.click(secondThumbnail);
      await user.click(screen.getByRole("button", { name: "View all media" }));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAccessibleName("Rose Serum");
      expect(within(dialog).getByTestId("product-lightbox-main").querySelector("img"))
        .toHaveAttribute("src", "/uploads/two.jpg");
    });

    it("steps through the media with the next and previous controls", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);
      const shown = () => within(dialog).getByTestId("product-lightbox-main").querySelector("img");

      expect(shown()).toHaveAttribute("src", "/uploads/one.jpg");

      await user.click(within(dialog).getByRole("button", { name: "Next media" }));
      expect(shown()).toHaveAttribute("src", "/uploads/two.jpg");

      await user.click(within(dialog).getByRole("button", { name: "Previous media" }));
      expect(shown()).toHaveAttribute("src", "/uploads/one.jpg");
    });

    it("stops at the ends instead of wrapping around", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      expect(within(dialog).getByRole("button", { name: "Previous media" })).toBeDisabled();
      await user.click(within(dialog).getByRole("button", { name: "Next media" }));
      expect(within(dialog).getByRole("button", { name: "Next media" })).toBeDisabled();
    });

    it("jumps to any item from the dialog's thumbnail strip", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      const thumbnails = within(screen.getByTestId("product-lightbox-thumbs")).getAllByRole("button");
      expect(thumbnails).toHaveLength(2);
      await user.click(thumbnails[1]!);

      expect(within(dialog).getByTestId("product-lightbox-main").querySelector("img"))
        .toHaveAttribute("src", "/uploads/two.jpg");
      expect(thumbnails[1]).toHaveAttribute("data-active", "true");
    });

    it("walks the media with the arrow keys", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      await user.keyboard("{ArrowRight}");
      expect(within(dialog).getByTestId("product-lightbox-main").querySelector("img"))
        .toHaveAttribute("src", "/uploads/two.jpg");

      await user.keyboard("{ArrowLeft}");
      expect(within(dialog).getByTestId("product-lightbox-main").querySelector("img"))
        .toHaveAttribute("src", "/uploads/one.jpg");
    });

    it("closes on the close control and on Escape, and frees the page scroll again", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      expect(document.documentElement.style.overflow).toBe("hidden");

      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.documentElement.style.overflow).toBe("");

      await user.click(screen.getByRole("button", { name: "View all media" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.documentElement.style.overflow).toBe("");
    });

    it("leaves the selection it ended on showing in the page gallery", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      await user.click(within(dialog).getByRole("button", { name: "Next media" }));
      await user.keyboard("{Escape}");

      expect(within(screen.getByTestId("product-media-thumbs")).getAllByRole("button")[1])
        .toHaveAttribute("data-active", "true");
    });

    it("names its controls in Arabic on an Arabic page", async () => {
      const user = userEvent.setup();
      render(createElement(EntityMediaGallery, {
        media: imageMedia,
        lang: "ar",
        imagePath: "/uploads/one.jpg",
        label: "سيروم الورد",
        testIdPrefix: "product",
        renderImage
      }));

      const open = screen.getByRole("button", { name: "عرض كل الوسائط" });
      await user.click(open);

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("button", { name: "التالي" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "السابق" })).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
    });

    it("declares its own direction and language, which the portal cannot inherit", async () => {
      const user = userEvent.setup();

      const arabic = await openLightbox(user, { lang: "ar", label: "سيروم الورد" });
      // Portalled to <body>, it sits outside the locale subtree that carries dir,
      // so it has to state its own or the arrows and layout come out mirrored.
      expect(arabic).toHaveAttribute("dir", "rtl");
      expect(arabic).toHaveAttribute("lang", "ar");
      expect(within(arabic).getByRole("heading").className).toContain("font-(family-name:--font-ar)");

      await user.keyboard("{Escape}");
      cleanup();

      const english = await openLightbox(user, { lang: "en" });
      expect(english).toHaveAttribute("dir", "ltr");
      expect(english).toHaveAttribute("lang", "en");
      expect(within(english).getByRole("heading").className).not.toContain("font-(family-name:--font-ar)");
    });

    it("points each arrow at the side it sits on", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      // Chevron draws a ">"; the one on the start side must be turned around, or
      // the pair reads back-to-front — which is what an unset dir caused.
      const previous = within(dialog).getByRole("button", { name: "Previous media" });
      const next = within(dialog).getByRole("button", { name: "Next media" });
      expect(previous.className).toContain("inset-s-");
      expect(previous.querySelector("svg")?.getAttribute("class")).toContain("rotate-180");
      expect(next.className).toContain("inset-e-");
      expect(next.querySelector("svg")?.getAttribute("class") ?? "").not.toContain("rotate-180");
    });

    it("shows the Arabic copy of a picture on an Arabic page", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user, {
        lang: "ar",
        label: "سيروم الورد",
        media: [{ type: "image", arUrl: "/uploads/ar.jpg", enUrl: "/uploads/en.jpg" }]
      });

      expect(within(dialog).getByTestId("product-lightbox-main").querySelector("img"))
        .toHaveAttribute("src", "/uploads/ar.jpg");
    });

    it("keeps the thumbnail strip centred at every width", async () => {
      const user = userEvent.setup();
      const dialog = await openLightbox(user);

      const strip = within(dialog).getByTestId("product-lightbox-thumbs");
      // Centred by an auto-margined track rather than justify-center, which
      // would clip the first thumbnails once the strip has to scroll.
      expect(strip.className).toContain("overflow-x-auto");
      const track = strip.firstElementChild as HTMLElement;
      expect(track.className).toContain("mx-auto");
      expect(track.className).toContain("w-max");
      expect(within(track).getAllByRole("button")).toHaveLength(2);
    });

    it("offers no expand control when the entity has no media at all", () => {
      render(createElement(EntityMediaGallery, {
        media: [],
        imagePath: "",
        label: "Rose Serum",
        testIdPrefix: "product",
        renderImage
      }));

      expect(screen.queryByRole("button", { name: "View all media" })).toBeNull();
    });
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
