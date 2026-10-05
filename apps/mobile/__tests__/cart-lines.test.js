jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const {
  cartLineAdditions,
  cartLineKey,
  mergeCartLines,
  normalizeCartLine,
  unionCartLines
} = require("../src/lib/cart-lines");

const product = (qty, variantId = 1) => ({ type: "product", productId: 1, variantId, qty });
const offer = (qty) => ({ type: "offer", offerId: 5, qty });
const collection = (qty) => ({ type: "collection", collectionId: 9, qty });

describe("normalizeCartLine", () => {
  test("accepts each well-formed line type", () => {
    expect(normalizeCartLine(product(2))).toEqual(product(2));
    expect(normalizeCartLine(offer(1))).toEqual(offer(1));
    expect(normalizeCartLine(collection(3))).toEqual(collection(3));
  });

  test.each([
    ["null", null],
    ["a number", 7],
    ["an unknown type", { type: "mystery", qty: 1 }],
    ["a product missing a variant", { type: "product", productId: 1, qty: 1 }],
    ["a fractional qty", { type: "product", productId: 1, variantId: 1, qty: 1.5 }],
    ["a zero qty", product(0)],
    ["a negative qty", offer(-2)],
    ["a string qty", { type: "offer", offerId: 5, qty: "2" }]
  ])("rejects %s", (_label, value) => {
    expect(normalizeCartLine(value)).toBeNull();
  });
});

describe("cartLineKey", () => {
  test("distinguishes entity type and identifiers", () => {
    expect(cartLineKey(product(1, 3))).toBe("p:1:3");
    expect(cartLineKey(offer(1))).toBe("o:5");
    expect(cartLineKey(collection(1))).toBe("c:9");
  });
});

describe("mergeCartLines", () => {
  test("keeps server order, appends local-only lines and sums shared quantities", () => {
    const merged = mergeCartLines([product(2), offer(1)], [product(3), collection(1)]);
    expect(merged).toEqual([product(5), collection(1), offer(1)]);
  });

  test("does not mutate its inputs", () => {
    const local = [product(2)];
    const server = [product(1)];
    mergeCartLines(local, server);
    expect(local).toEqual([product(2)]);
    expect(server).toEqual([product(1)]);
  });
});

describe("cartLineAdditions", () => {
  test("returns a copy of the whole cart when there is no synced snapshot", () => {
    const local = [product(2)];
    const additions = cartLineAdditions(local, null);
    expect(additions).toEqual([product(2)]);
    expect(additions[0]).not.toBe(local[0]);
  });

  test("includes only new lines and only the quantity added on top of a synced line", () => {
    const additions = cartLineAdditions([product(5), offer(2)], [product(3), offer(2)]);
    expect(additions).toEqual([product(2)]);
  });

  test("drops decreases so the server snapshot wins", () => {
    expect(cartLineAdditions([product(1)], [product(3)])).toEqual([]);
  });
});

describe("unionCartLines", () => {
  test("keeps primary lines and appends unique secondary lines without summing", () => {
    const union = unionCartLines([product(2)], [product(2), offer(1)]);
    expect(union).toEqual([product(2), offer(1)]);
  });
});
