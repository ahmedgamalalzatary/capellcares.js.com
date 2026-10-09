import { describe, expect, it } from "vitest";
import { API_BASE } from "@/lib/api/client";
import { MAX_IMAGE_BYTES, resolveMediaSrc, validateImageFile } from "@/lib/media";

describe("validateImageFile", () => {
  const file = (type: string, size = 1024) => ({ type, size }) as File;

  it("accepts PNG, JPG and WEBP within the size cap", () => {
    expect(validateImageFile(file("image/png"))).toBeNull();
    expect(validateImageFile(file("image/jpeg"))).toBeNull();
    expect(validateImageFile(file("image/webp", MAX_IMAGE_BYTES))).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(validateImageFile(file("image/gif"))).toBe("نوع الصورة غير مدعوم. استخدمي PNG أو JPG أو WEBP.");
  });

  it("rejects a file larger than the cap", () => {
    expect(validateImageFile(file("image/png", MAX_IMAGE_BYTES + 1))).toBe("حجم الصورة أكبر من 4 ميجابايت.");
  });
});

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
