import type { AnnouncementBarDto } from "@minikoshk/shared";
import { apiGetOr } from "@/lib/api/client";
import { getCategories, selectMenuCategories } from "@/lib/categories";
import { AnnouncementBar } from "./AnnouncementBar";
import { MobileHeader } from "./MobileHeader";
import { SearchBar } from "./SearchBar";
import { NavBar } from "./NavBar";

/**
 * Full site header. Below `lg` it collapses to a single row plus a slide-in
 * drawer; from `lg` up it keeps the search row and navigation row.
 */
export async function Header() {
  const [announcementBar, categories] = await Promise.all([
    apiGetOr<AnnouncementBarDto>("/announcement-bar", { enabled: false, items: [] }, { next: { revalidate: 10 } }),
    getCategories()
  ]);

  return (
    <>
      {/* Announcement bar scrolls away with the page. */}
      <AnnouncementBar config={announcementBar} />
      {/* The header itself is the sticky element. Because it's a direct child
          of the page flow (not nested in a short wrapper), its containing block
          is the body, so it stays pinned for the whole scroll. */}
      <header className="sticky top-0 z-50 shadow-sm">
        <MobileHeader menuCategories={selectMenuCategories(categories)} />
        <SearchBar />
        <NavBar />
      </header>
    </>
  );
}
