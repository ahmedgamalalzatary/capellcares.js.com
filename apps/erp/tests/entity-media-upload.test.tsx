import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { uploadMedia } = vi.hoisted(() => ({ uploadMedia: vi.fn() }));

vi.mock("@/lib/api/client", () => ({
  API_BASE: "http://localhost:4000",
  api: { uploadMedia }
}));

vi.mock("@/components/ui/icons", () => ({
  Icon: {
    Upload: () => <span>upload</span>,
    Trash: () => <span>trash</span>,
    Chevron: () => <span>move</span>
  }
}));

import { EntityMediaUpload } from "@/components/forms/product-media-upload";

afterEach(() => {
  cleanup();
  uploadMedia.mockReset();
});

describe("EntityMediaUpload", () => {
  it("renders Arabic and English controls for every image while videos stay shared", () => {
    render(
      <EntityMediaUpload
        value={[
          { type: "image", arUrl: "/uploads/ar.jpg", enUrl: "/uploads/en.jpg" },
          { type: "video", url: "/uploads/demo.mp4" }
        ]}
        onChange={vi.fn()}
        uploadContext="products.update"
      />
    );

    expect(screen.getByTestId("product-media-image-ar-input-0")).toBeInTheDocument();
    expect(screen.getByTestId("product-media-image-en-input-0")).toBeInTheDocument();
    expect(screen.getByTestId("product-media-video-1")).toHaveAttribute("src", "/uploads/demo.mp4");
  });

  it("can append an Arabic-only image that English storefronts may fall back to", async () => {
    const onChange = vi.fn();
    uploadMedia.mockResolvedValue({ url: "/uploads/new-ar.jpg" });
    render(
      <EntityMediaUpload
        value={[]}
        onChange={onChange}
        uploadContext="offers.update"
        testIdPrefix="offer"
      />
    );

    fireEvent.change(screen.getByTestId("offer-media-add-ar-input"), {
      target: { files: [new File(["image"], "ar.jpg", { type: "image/jpeg" })] }
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        { type: "image", arUrl: "/uploads/new-ar.jpg", enUrl: null }
      ]);
    });
  });
});
