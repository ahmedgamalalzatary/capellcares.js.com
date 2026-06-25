import { AnnouncementBar } from "./AnnouncementBar";
import { SearchBar } from "./SearchBar";
import { NavBar } from "./NavBar";

/** Full site header: announcement bar, search row, and navigation row. */
export function Header() {
  return (
    <header>
      <AnnouncementBar />
      <SearchBar />
      <NavBar />
    </header>
  );
}
