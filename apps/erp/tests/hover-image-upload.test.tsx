import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  API_BASE: "http://localhost:4000",
  api: { uploadImage: vi.fn() }
}));

vi.mock("@/components/ui/icons", () => ({
  Icon: {
    Upload: () => <span>upload</span>,
    Trash: () => <span>trash</span>
  }
}));

import { HoverImageUpload } from "@/components/forms/hover-image-upload";

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
});
