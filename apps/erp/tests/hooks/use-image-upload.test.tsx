import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  API_BASE: "http://localhost:4000",
  api: { uploadImage: vi.fn() }
}));

import { api } from "@/lib/api/client";
import { useImageUpload } from "@/hooks/use-image-upload";

const file = (type: string, size = 1024) => ({ type, size }) as File;
const fileList = (f: File) => ({ 0: f, length: 1 }) as unknown as FileList;

describe("useImageUpload", () => {
  beforeEach(() => {
    vi.mocked(api.uploadImage).mockReset();
  });

  it("returns the uploaded url", async () => {
    vi.mocked(api.uploadImage).mockResolvedValue({ url: "/uploads/a.png", path: "a.png", fileName: "a.png" });
    const { result } = renderHook(() => useImageUpload("products.create"));

    let url: string | null = null;
    await act(async () => {
      url = await result.current.upload(fileList(file("image/png")));
    });

    expect(url).toBe("/uploads/a.png");
    expect(result.current.error).toBeNull();
  });

  it("shows a validation error and skips the request for an unsupported file", async () => {
    const { result } = renderHook(() => useImageUpload("products.create"));

    let url: string | null = "x";
    await act(async () => {
      url = await result.current.upload(fileList(file("image/gif")));
    });

    expect(url).toBeNull();
    expect(result.current.error).toBe("نوع الصورة غير مدعوم. استخدمي PNG أو JPG أو WEBP.");
    expect(api.uploadImage).not.toHaveBeenCalled();
  });

  it("surfaces the server message when the upload fails", async () => {
    vi.mocked(api.uploadImage).mockRejectedValue(
      Object.assign(new Error("API 409 /api/erp/uploads"), { body: { message: "الصورة كبيرة جدًا" } })
    );
    const { result } = renderHook(() => useImageUpload("products.create"));

    let url: string | null = "x";
    await act(async () => {
      url = await result.current.upload(fileList(file("image/png")));
    });

    expect(url).toBeNull();
    expect(result.current.error).toBe("الصورة كبيرة جدًا");
  });
});
