import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL only auto-registers cleanup when the test globals exist; this project runs Vitest without `globals: true`, so every render() would stay mounted in document.body and a later case would see duplicate test ids and label associations from earlier cases.
// Unmount after every case.
afterEach(() => {
  cleanup();
});
