import { resolve } from "node:path";
import type { NextConfig } from "next";
import { loadWorkspaceEnv } from "@capella/shared/config/workspace-env";

loadWorkspaceEnv();

function resolveRemotePatterns() {
  const candidates = [
    process.env.NEXT_PUBLIC_API_URL?.trim(),
    "http://localhost:4000"
  ].filter((value): value is string => Boolean(value));

  const unique = new Map<string, NonNullable<NextConfig["images"]>["remotePatterns"][number]>();

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const key = `${url.protocol}//${url.hostname}:${url.port}`;
      unique.set(key, {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port,
        pathname: "/uploads/**"
      });
    } catch {
      continue;
    }
  }

  return Array.from(unique.values());
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), "..", ".."),
  reactStrictMode: true,
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: resolveRemotePatterns()
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  },
  transpilePackages: ["@capella/shared"],
  typedRoutes: false,
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"]
    };
    return config;
  }
};

export default nextConfig;
