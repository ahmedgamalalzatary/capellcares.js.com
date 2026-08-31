import { AUTH_STORAGE_KEY, CART_STORAGE_KEY, LANG_STORAGE_KEY } from "../src/constants/storage";

describe("mobile storage keys", () => {
  it("reuses the storefront cart and auth keys and adds a language key", () => {
    expect(CART_STORAGE_KEY).toBe("capella.cart.v1");
    expect(AUTH_STORAGE_KEY).toBe("capella.auth.v1");
    expect(LANG_STORAGE_KEY).toBe("capella.lang.v1");
  });
});
