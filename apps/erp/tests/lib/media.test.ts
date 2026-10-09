import { describe, expect, it } from "vitest";
import { API_BASE } from "@/lib/api/client";
import { resolveMediaSrc } from "@/lib/media";

describe("resolveMediaSrc", () => {
  it("returns http and https URLs unchanged", () => {
    expect(resolveMediaSrc("http://cdn.example.com/a.jpg")).toBe("http://cdn.example.com/a.jpg");
    expect(resolveMediaSrc("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
  });

  it("prefixes a relative /uploads/ path with the API base", () => {
    expect(resolveMediaSrc("/uploads/a.jpg")).toBe(`${API_BASE}/uploads/a.jpg`);
  });

  it("returns any other value unchanged", () => {
    expect(resolveMediaSrc("a.jpg")).toBe("a.jpg");
    expect(resolveMediaSrc("/other/a.jpg")).toBe("/other/a.jpg");
  });

  it("returns an empty string for an empty value", () => {
    expect(resolveMediaSrc("")).toBe("");
  });
});
