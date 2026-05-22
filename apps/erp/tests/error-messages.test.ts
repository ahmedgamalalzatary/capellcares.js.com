import { describe, expect, it } from "vitest";

import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage", () => {
  it("maps duplicate category slug conflicts to a human-readable message", () => {
    const error = Object.assign(new Error("API 409 /api/erp/categories"), {
      status: 409,
      body: { reason: "slug-conflict" }
    });

    expect(getErrorMessage(error)).toBe("اسم القسم الإنجليزي مستخدم بالفعل. غيّري الاسم ثم أعيدي المحاولة.");
  });

  it("falls back to the original error message when there is no known mapping", () => {
    expect(getErrorMessage(new Error("toggle failed"))).toBe("toggle failed");
  });
});
