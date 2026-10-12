jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
const {
  clearBrowsingCache,
  readPersistentValue,
  writePersistentValue
} = require("../../src/lib/persistent-storage");

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async multiRemove(keys) { keys.forEach((key) => values.delete(key)); }
  };
}

const language = {
  key: "capella.lang.v1",
  decode: (raw) => raw === "ar" || raw === "en" ? raw : null,
  encode: (value) => value
};

describe("persistent storage boundaries", () => {
  test("hydrates only a validated saved value", async () => {
    await expect(readPersistentValue(language, storage({ "capella.lang.v1": "en" }))).resolves.toBe("en");
  });

  test("preserves malformed values while refusing to hydrate them", async () => {
    const backend = storage({ "capella.lang.v1": "future-language" });
    await expect(readPersistentValue(language, backend)).resolves.toBeNull();
    expect(backend.values.get("capella.lang.v1")).toBe("future-language");
  });

  test("copies a validated legacy value forward without removing the rollback source", async () => {
    const backend = storage({ "capella.lang.v0": '"en"' });
    const upgraded = {
      ...language,
      migrations: [{ key: "capella.lang.v0", decode: (raw) => raw === '"en"' ? "en" : null }]
    };
    await expect(readPersistentValue(upgraded, backend)).resolves.toBe("en");
    expect(backend.values.get("capella.lang.v1")).toBe("en");
    expect(backend.values.get("capella.lang.v0")).toBe('"en"');
  });

  test("does not replace a current value with an older migration source", async () => {
    const backend = storage({ "capella.lang.v1": "ar", "capella.lang.v0": '"en"' });
    await expect(readPersistentValue({ ...language, migrations: [{ key: "capella.lang.v0", decode: () => "en" }] }, backend)).resolves.toBe("ar");
  });

  test("propagates migration write failure without deleting original data", async () => {
    const backend = storage({ "capella.lang.v0": '"en"' });
    backend.setItem = async () => { throw new Error("storage unavailable"); };
    await expect(readPersistentValue({ ...language, migrations: [{ key: "capella.lang.v0", decode: () => "en" }] }, backend)).rejects.toThrow("storage unavailable");
    expect(backend.values.get("capella.lang.v0")).toBe('"en"');
    expect(backend.values.has("capella.lang.v1")).toBe(false);
  });

  test("rejects invalid writes before changing saved data", async () => {
    const backend = storage({ "capella.lang.v1": "ar" });
    await expect(writePersistentValue(language, "invalid", backend)).rejects.toThrow("Invalid persistent value");
    expect(backend.values.get("capella.lang.v1")).toBe("ar");
  });

  test("persists validated writes and propagates storage failure", async () => {
    const backend = storage();
    await writePersistentValue(language, "en", backend);
    expect(backend.values.get("capella.lang.v1")).toBe("en");
    backend.setItem = async () => { throw new Error("storage unavailable"); };
    await expect(writePersistentValue(language, "ar", backend)).rejects.toThrow("storage unavailable");
  });

  test("clears only guest cart and Ask caches, preserving auth, pending cart writes and payment recovery", async () => {
    const backend = storage({
      "capella.cart.v1": "guest cart",
      "capella.ask.v1": "conversation",
      "capella:ask:v1": "legacy conversation",
      "capella.auth.v1": "identity",
      "capella.lang.v1": "ar",
      "capella.customer.refresh-token.v1": "credentials",
      "capella.cart.pending.v1": "pending account cart",
      "capella.checkout.recovery.v1": "unresolved payment"
    });
    await clearBrowsingCache(backend);
    expect(Object.fromEntries(backend.values)).toEqual({
      "capella.auth.v1": "identity",
      "capella.lang.v1": "ar",
      "capella.customer.refresh-token.v1": "credentials",
      "capella.cart.pending.v1": "pending account cart",
      "capella.checkout.recovery.v1": "unresolved payment"
    });
  });

  test("does not overwrite a current value saved while a migration reads legacy data", async () => {
    const backend = storage({ "capella.lang.v0": '"en"' });
    const getItem = backend.getItem;
    backend.getItem = async (key) => {
      const value = await getItem(key);
      if (key === "capella.lang.v0") backend.values.set("capella.lang.v1", "ar");
      return value;
    };
    await expect(readPersistentValue({ ...language, migrations: [{ key: "capella.lang.v0", decode: () => "en" }] }, backend)).resolves.toBe("ar");
    expect(backend.values.get("capella.lang.v1")).toBe("ar");
  });

  test("persists only the validated recovery fields instead of an attached checkout form", async () => {
    const backend = storage();
    const recovery = {
      key: "capella.checkout.recovery.v1",
      decode: (raw) => {
        const value = JSON.parse(raw);
        return typeof value.checkoutId === "string" ? { checkoutId: value.checkoutId } : null;
      },
      encode: JSON.stringify
    };
    await writePersistentValue(recovery, { checkoutId: "checkout-reference", name: "Customer", address: "Form draft" }, backend);
    expect(JSON.parse(backend.values.get(recovery.key))).toEqual({ checkoutId: "checkout-reference" });
  });

  test("hydrates a migration through the current validator before publishing it", async () => {
    const legacy = JSON.stringify({ checkoutId: "checkout-reference", address: "Old form draft" });
    const backend = storage({ "capella.checkout.recovery.v0": legacy });
    const recovery = {
      key: "capella.checkout.recovery.v1",
      decode: (raw) => {
        const value = JSON.parse(raw);
        return typeof value.checkoutId === "string" ? { checkoutId: value.checkoutId } : null;
      },
      encode: JSON.stringify,
      migrations: [{ key: "capella.checkout.recovery.v0", decode: JSON.parse }]
    };
    await expect(readPersistentValue(recovery, backend)).resolves.toEqual({ checkoutId: "checkout-reference" });
    expect(backend.values.get("capella.checkout.recovery.v0")).toBe(legacy);
  });
});
