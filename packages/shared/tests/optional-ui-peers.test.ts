import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "../package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const uiPeers = [
  "class-variance-authority",
  "clsx",
  "lucide-react",
  "radix-ui",
  "react",
  "tailwind-merge"
];

test("DOM UI libraries are optional peers, not hard dependencies", () => {
  for (const name of uiPeers) {
    assert.equal(pkg.dependencies?.[name], undefined, `${name} must not be a hard dependency`);
    assert.ok(pkg.peerDependencies?.[name], `${name} must be a peerDependency`);
    assert.equal(pkg.peerDependenciesMeta?.[name]?.optional, true, `${name} must be optional`);
  }
  assert.ok(pkg.dependencies?.zod, "zod stays a hard dependency of the pure TS exports");
});
