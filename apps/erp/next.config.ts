import { resolve } from "node:path";
import type { NextConfig } from "next";
import { loadWorkspaceEnv } from "@minikoshk/shared/config/workspace-env";

loadWorkspaceEnv();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "..", ".."),
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  },
  transpilePackages: ["@minikoshk/shared"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"]
    };
    return config;
  }
};
export default nextConfig;
