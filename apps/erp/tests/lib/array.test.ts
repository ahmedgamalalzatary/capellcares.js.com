import { describe, expect, it } from "vitest";
import { moveItem } from "@/lib/array";

describe("moveItem", () => {
  it("moves an item down by one", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("moves an item up by one", () => {
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("returns the same array when moving the first item up", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 0, -1)).toBe(items);
  });

  it("returns the same array when moving the last item down", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 2, 1)).toBe(items);
  });

  it("does not mutate the input", () => {
    const items = ["a", "b", "c"];
    moveItem(items, 0, 1);
    expect(items).toEqual(["a", "b", "c"]);
  });
});
