import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useProductForm variant synchronization", () => {
  it("keeps updateVariant pure and synchronizes the variants ref in an effect", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/forms/use-product-form.ts"), "utf8");
    const updateVariant = source.match(/const updateVariant[\s\S]*?\n  };\n\n  useEffect/)?.[0] ?? "";

    expect(updateVariant).not.toContain("variantsRef.current");
    expect(source).toMatch(/useEffect\(\(\) => \{\s*variantsRef\.current = variants;\s*}, \[variants\]\);/);
  });
});
