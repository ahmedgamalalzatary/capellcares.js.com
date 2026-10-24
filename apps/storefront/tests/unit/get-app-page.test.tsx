import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import GetAppPage, { generateMetadata } from "@/app/[lang]/get-app/page";

describe("get the app page", () => {
  it("says the app is coming soon, with a way back to the shop", async () => {
    render(await GetAppPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to shop" })).toHaveAttribute("href", "/en/shop");
  });

  it("keeps the placeholder page out of search results", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ lang: "ar" }) });

    expect(metadata.robots).toMatchObject({ index: false });
  });
});
