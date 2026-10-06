import {
  AUTH_STORAGE_KEY,
  CART_STORAGE_KEY,
  CUSTOMER_REFRESH_TOKEN_KEY,
  LANG_STORAGE_KEY
} from "../../src/constants/storage";

describe("mobile storage keys", () => {
  it("reuses the storefront cart and auth keys and adds language and refresh-token keys", () => {
    expect(CART_STORAGE_KEY).toBe("capella.cart.v1");
    expect(AUTH_STORAGE_KEY).toBe("capella.auth.v1");
    expect(LANG_STORAGE_KEY).toBe("capella.lang.v1");
  });

  it("keeps a separate customer refresh token key", () => {
    expect(CUSTOMER_REFRESH_TOKEN_KEY).toBe("capella.customer.refresh-token.v1");
  });
});
