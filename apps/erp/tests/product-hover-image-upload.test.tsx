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

import { ProductHoverImageUpload } from "@/components/forms/product-hover-image-upload";

afterEach(cleanup);

describe("ProductHoverImageUpload", () => {
  it("renders optional Arabic and English hover-image controls", () => {
    render(
      <ProductHoverImageUpload
        {...({
          value: "",
          arValue: "/uploads/hover-ar.jpg",
          enValue: "/uploads/hover-en.jpg",
          onChange: vi.fn(),
          uploadContext: "products.update"
        } as any)}
      />
    );

    expect(screen.getByTestId("product-hover-image-ar-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-hover-image-en-input")).toBeInTheDocument();
  });
});
