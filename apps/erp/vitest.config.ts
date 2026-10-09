import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // React's entry picks its production build (no `act`) when process.env.NODE_ENV is replaced with "production" during transform; pin it so React Testing Library gets a working act.
  define: {
    "process.env.NODE_ENV": JSON.stringify("test")
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    maxWorkers: "75%",
    fileParallelism: true
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  }
});
