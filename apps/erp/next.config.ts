import { resolve } from "node:path";
import type { NextConfig } from "next";
import { loadWorkspaceEnv } from "@capella/shared/config/workspace-env";
import { webSecurityHeaders } from "@capella/shared/config/security-headers";

loadWorkspaceEnv();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "..", ".."),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: webSecurityHeaders }];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  },
  transpilePackages: ["@capella/shared"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"]
    };
    return config;
  }
};
export default nextConfig;
