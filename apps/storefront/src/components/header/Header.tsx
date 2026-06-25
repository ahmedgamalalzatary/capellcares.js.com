import { AnnouncementBar } from "./AnnouncementBar";
import { SearchBar } from "./SearchBar";
import { NavBar } from "./NavBar";

/** Full site header: announcement bar, search row, and navigation row. */
export function Header() {
  return (
    <>
      {/* Announcement bar scrolls away with the page. */}
      <AnnouncementBar />
      {/* The header itself is the sticky element. Because it's a direct child
          of the page flow (not nested in a short wrapper), its containing block
          is the body, so it stays pinned for the whole scroll. */}
      <header className="sticky top-0 z-50 shadow-sm">
        <SearchBar />
        <NavBar />
      </header>
    </>
  );
}
