import { getDict } from "@capella/shared/i18n";

describe("shared package bundling", () => {
  it("imports the Arabic dictionary brand from @capella/shared", () => {
    expect(getDict("ar").brand).toBe("كابيلا كير");
  });
});
