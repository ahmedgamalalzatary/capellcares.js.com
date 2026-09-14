const sharedPackage = require("../../../packages/shared/package.json");

const domOnlyPackages = [
  "class-variance-authority",
  "clsx",
  "lucide-react",
  "radix-ui",
  "react",
  "tailwind-merge"
];

describe("shared-package mobile boundary", () => {
  test.each(domOnlyPackages)("does not install DOM-only dependency %s for mobile", (name) => {
    expect(sharedPackage.dependencies).not.toHaveProperty(name);
    expect(sharedPackage.peerDependencies).toHaveProperty(name);
    expect(sharedPackage.peerDependenciesMeta[name]).toEqual({ optional: true });
  });
});
