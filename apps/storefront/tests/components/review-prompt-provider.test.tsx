import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, claimReviewPrompt, submitReview } = vi.hoisted(() => ({
  auth: { accessToken: "customer-token" as string | null },
  claimReviewPrompt: vi.fn(),
  submitReview: vi.fn()
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 }, accessToken: auth.accessToken })
}));

vi.mock("@/lib/api/client", () => ({ claimReviewPrompt, submitReview }));

import { ReviewPromptProvider } from "@/components/providers/review-prompt-provider";

const dict = {
  reviews: {
    promptTitle: "How was your purchase?",
    rating: "Rating",
    starLabel: "{count} stars",
    comment: "Your review",
    commentPlaceholder: "Share your experience",
    submit: "Submit review",
    submitting: "Submitting…",
    dismiss: "Not now",
    close: "Close",
    validation: "Choose 1–5 stars and write at least 3 characters.",
    submitError: "Could not submit your review. Please try again."
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  claimReviewPrompt.mockReset();
  submitReview.mockReset();
  auth.accessToken = "customer-token";
  claimReviewPrompt.mockResolvedValue({
    entityType: "offer",
    entityId: 9,
    name: { ar: "عرض", en: "Newest offer" },
    imagePath: "/uploads/offer.jpg",
    href: "/offers/newest-offer"
  });
});

describe("ReviewPromptProvider", () => {
  it("clears a claimed prompt immediately when the access token changes", async () => {
    let resolveSecondClaim!: (value: null) => void;
    claimReviewPrompt
      .mockResolvedValueOnce({
        entityType: "offer",
        entityId: 9,
        name: { ar: "عرض", en: "Newest offer" },
        imagePath: "/uploads/offer.jpg",
        href: "/offers/newest-offer"
      })
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecondClaim = resolve; }));
    const { rerender } = render(createElement(ReviewPromptProvider, { lang: "en", dict }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    auth.accessToken = "second-customer-token";
    rerender(createElement(ReviewPromptProvider, { lang: "en", dict }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    resolveSecondClaim(null);
    await Promise.resolve();
  });

  it("can retry the same token after an optional prompt claim fails", async () => {
    claimReviewPrompt.mockRejectedValueOnce(new Error("network failed")).mockResolvedValueOnce(null);
    const { rerender } = render(createElement(ReviewPromptProvider, { lang: "en", dict }));
    await waitFor(() => expect(claimReviewPrompt).toHaveBeenCalledTimes(1));

    auth.accessToken = null;
    rerender(createElement(ReviewPromptProvider, { lang: "en", dict }));
    auth.accessToken = "customer-token";
    rerender(createElement(ReviewPromptProvider, { lang: "en", dict }));

    await waitFor(() => expect(claimReviewPrompt).toHaveBeenCalledTimes(2));
  });

  it("claims and shows only the latest eligible purchase once per mounted session", async () => {
    const { rerender } = render(createElement(ReviewPromptProvider, { lang: "en", dict }, createElement("div", null, "Store")));

    expect(await screen.findByRole("dialog", { name: "How was your purchase?" })).toBeInTheDocument();
    expect(screen.getByText("Newest offer")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Newest offer" })).toHaveAttribute("src", expect.stringContaining("/uploads/offer.jpg"));
    expect(claimReviewPrompt).toHaveBeenCalledTimes(1);
    expect(claimReviewPrompt).toHaveBeenCalledWith("customer-token");

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(createElement(ReviewPromptProvider, { lang: "en", dict }, createElement("div", null, "Store")));
    await waitFor(() => expect(claimReviewPrompt).toHaveBeenCalledTimes(1));
  });
});
