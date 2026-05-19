import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdviceSection } from "@/components/products/advice-section";

describe("AdviceSection", () => {
  it("renders active advice cards on the storefront products page", () => {
    render(createElement(AdviceSection, {
      lang: "en",
      dict: { advices: { title: "Capella Advices", description: "Helpful guidance" } },
      advices: [{
        id: 1,
        title: { ar: "نصيحة", en: "Advice" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/advice.png",
        videoUrl: "https://instagram.com/capella",
        status: "active",
        sortOrder: 1,
        createdAt: "",
        updatedAt: ""
      }]
    }));

    expect(screen.getAllByText("Capella Advices")).toHaveLength(2);
    expect(screen.getByText("Advice")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Advice" })).toHaveAttribute("src", "/uploads/advice.png");
  });
});
