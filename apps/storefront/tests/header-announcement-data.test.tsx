import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { AnnouncementBarDto } from "@minikoshk/shared";

const { apiGetOr } = vi.hoisted(() => ({ apiGetOr: vi.fn() }));

vi.mock("@/lib/api/client", () => ({ apiGetOr }));
vi.mock("@/components/header/AnnouncementBar", () => ({
  AnnouncementBar: ({ config }: { config?: AnnouncementBarDto }) => (
    <div>{config?.items[0]?.text.en ?? "missing announcement config"}</div>
  )
}));
vi.mock("@/components/header/SearchBar", () => ({ SearchBar: () => <div>search</div> }));
vi.mock("@/components/header/NavBar", () => ({ NavBar: () => <div>nav</div> }));

import { Header } from "@/components/header/Header";

beforeEach(() => {
  apiGetOr.mockReset();
});

it("loads announcement configuration server-side and passes it to the marquee", async () => {
  apiGetOr.mockResolvedValue({
    enabled: true,
    items: [{
      id: 7,
      text: { ar: "عرض", en: "Server announcement" },
      isActive: true,
      sortOrder: 0
    }]
  });

  render(await Header());

  expect(apiGetOr).toHaveBeenCalledWith(
    "/announcement-bar",
    { enabled: false, items: [] },
    { next: { revalidate: 10 } }
  );
  expect(screen.getByText("Server announcement")).toBeInTheDocument();
});
