import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL only auto-registers cleanup when the test globals exist; this project runs
// Vitest without `globals: true`, so without this every render() stays mounted in
// document.body. A later case then sees duplicate test ids and label associations
// from earlier cases (a shuffled-order failure), so unmount after every case.
afterEach(() => {
  cleanup();
});
