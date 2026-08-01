import { createElement, Fragment, useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({ fetchPublicReviews: vi.fn() }));

import { ReviewSummary } from "@/components/reviews/review-summary";
import { useModalAccessibility } from "@/components/reviews/use-modal-accessibility";

const dict = {
  reviews: {
    title: "Customer reviews",
    outOfFive: "{rating} out of 5",
    reviewCount: "{count} reviews",
    close: "Close",
    noReviews: "No reviews yet",
    verifiedPurchase: "Verified purchase",
    loading: "Loading",
    loadMore: "Load more",
    loadError: "Could not load reviews"
  }
};

const reviewData = {
  summary: { averageRating: 4.5, reviewCount: 1, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 } },
  items: [{ id: 1, firstName: "Sara", rating: 5, comment: "Excellent", createdAt: "2026-08-01T00:00:00.000Z", verifiedPurchase: true as const }],
  pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
};

describe("ReviewSummary dialog", () => {
  it("shows the existing load error when review enrichment is unavailable", () => {
    render(createElement(ReviewSummary, { entityType: "product", entityId: 7, reviewData: null, lang: "en", dict }));

    expect(screen.getByRole("alert")).toHaveTextContent("Could not load reviews");
  });

  it("moves focus into the dialog, traps it, and restores the opener", async () => {
    render(createElement(ReviewSummary, { entityType: "product", entityId: 7, reviewData, lang: "en", dict }));
    const opener = screen.getByRole("button", { name: "4.5 out of 5, 1 reviews" });
    opener.focus();
    fireEvent.click(opener);

    const close = screen.getByRole("button", { name: "Close" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(screen.getByRole("img", { name: "5 out of 5" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.click(close);
    expect(opener).toHaveFocus();
  });

  it("keeps concurrent dialogs isolated until the final modal closes", () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    function ModalHarness({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
      const overlayRef = useRef<HTMLDivElement>(null);
      const dialogRef = useRef<HTMLDivElement>(null);
      useModalAccessibility(open, overlayRef, dialogRef, onClose);
      return open
        ? createElement("div", { ref: overlayRef, "data-testid": `${name}-overlay` },
            createElement("div", { ref: dialogRef, tabIndex: -1, role: "dialog", "aria-modal": "true", "aria-label": name }))
        : null;
    }

    document.body.style.overflow = "scroll";
    const { rerender, unmount } = render(createElement(Fragment, null,
      createElement("button", { "data-testid": "background" }, "Background"),
      createElement(ModalHarness, { open: true, onClose: firstClose, name: "first" }),
      createElement(ModalHarness, { open: true, onClose: secondClose, name: "second" })
    ));
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByTestId("first-overlay")).not.toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("second-overlay")).not.toHaveAttribute("aria-hidden", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledTimes(1);

    rerender(createElement(Fragment, null,
      createElement("button", { "data-testid": "background" }, "Background"),
      createElement(ModalHarness, { open: false, onClose: firstClose, name: "first" }),
      createElement(ModalHarness, { open: true, onClose: secondClose, name: "second" })
    ));
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByTestId("background")).toHaveAttribute("aria-hidden", "true");

    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });
});
