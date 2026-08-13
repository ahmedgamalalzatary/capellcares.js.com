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

  it("maps duplicate same-parent grandchild names to a human-readable message", () => {
    const error = Object.assign(new Error("API 409 /api/erp/categories"), {
      status: 409,
      body: { reason: "category-name-conflict" }
    });

    expect(getErrorMessage(error)).toBe("اسم القسم مستخدم بالفعل داخل القسم الأب الحالي. غيّري الاسم أو اختاري قسمًا أبًا مختلفًا.");
  });

  it("maps linked offer conflicts to a human-readable message", () => {
    const error = Object.assign(new Error("API 409 /api/erp/products/1"), {
      status: 409,
      body: { reason: "linked-to-offers" }
    });

    expect(getErrorMessage(error)).toBe("لا يمكن حذف المنتج أو حذف أحد مقاساته لأنه مستخدم داخل عرض. عدّلي العرض أولًا ثم أعيدي المحاولة.");
  });

  it.each([
    ["linked-to-orders", "لا يمكن الحذف النهائي لأن العنصر مرتبط بطلبات سابقة."],
    ["linked-entities", "لا يمكن حذف القسم نهائيًا لأنه ما زال مرتبطًا بأقسام أو منتجات أو عروض أو مجموعات."],
    ["linked-to-collections", "لا يمكن حذف المنتج لأنه مستخدم داخل مجموعة. عدّلي المجموعة أولًا ثم أعيدي المحاولة."]
  ])("maps %s conflicts to a human-readable message", (reason, expected) => {
    const error = Object.assign(new Error("API 409"), { status: 409, body: { reason } });
    expect(getErrorMessage(error)).toBe(expected);
  });

  it("falls back to the original error message when there is no known mapping", () => {
    expect(getErrorMessage(new Error("toggle failed"))).toBe("toggle failed");
  });
});
