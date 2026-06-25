import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    maxWorkers: 1,
    fileParallelism: false
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  }
});
