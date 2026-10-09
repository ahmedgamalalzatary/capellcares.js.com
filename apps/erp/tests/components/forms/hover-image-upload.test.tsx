import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  API_BASE: "http://localhost:4000",
  api: { uploadImage: vi.fn() }
}));

import { HoverImageUpload } from "@/components/forms/hover-image-upload";
import { api } from "@/lib/api/client";

afterEach(cleanup);

describe("HoverImageUpload", () => {
  it("renders Arabic and English hover-image controls keyed by the entity test-id prefix", () => {
    render(
      <HoverImageUpload
        arValue="/uploads/offer-hover-ar.jpg"
        enValue="/uploads/offer-hover-en.jpg"
        onChange={vi.fn()}
        uploadContext="offers.update"
        entityLabel="عرض"
        testIdPrefix="offer"
      />
    );

    expect(screen.getByTestId("offer-hover-image-ar-input")).toBeInTheDocument();
    expect(screen.getByTestId("offer-hover-image-en-input")).toBeInTheDocument();
  });

  it("defaults to the product entity", () => {
    render(
      <HoverImageUpload
        arValue=""
        enValue=""
        onChange={vi.fn()}
        uploadContext="products.update"
      />
    );

    expect(screen.getByTestId("product-hover-image-ar-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-hover-image-en-input")).toBeInTheDocument();
  });

  it("shows the server's message for a rejected upload instead of the raw API error", async () => {
    vi.mocked(api.uploadImage).mockRejectedValueOnce(
      Object.assign(new Error("API 409 /api/erp/uploads"), { status: 409, body: { message: "الصورة كبيرة جدًا" } })
    );

    render(<HoverImageUpload arValue="" enValue="" onChange={vi.fn()} uploadContext="offers.update" />);

    fireEvent.change(screen.getByTestId("product-hover-image-ar-input"), {
      target: { files: [new File(["x"], "img.png", { type: "image/png" })] }
    });

    await waitFor(() => expect(screen.getByText("الصورة كبيرة جدًا")).toBeInTheDocument());
  });
});
