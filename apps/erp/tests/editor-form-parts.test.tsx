import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BilingualEditorField } from "@/components/forms/editor-form-parts";
import { BilingualNameFields } from "@/components/forms/editor-form-parts";
import { EditorActions } from "@/components/forms/editor-form-parts";
import { ImageFieldCard } from "@/components/forms/editor-form-parts";

describe("editor form parts", () => {
  it("renders bilingual textarea fields and forwards changes", () => {
    const setAr = vi.fn();
    const setEn = vi.fn();

    render(createElement(BilingualEditorField, {
      label: "الوصف",
      arValue: "عربي",
      enValue: "English",
      onArChange: setAr,
      onEnChange: setEn,
      multiline: true
    }));

    fireEvent.change(screen.getByDisplayValue("عربي"), { target: { value: "جديد" } });
    fireEvent.change(screen.getByDisplayValue("English"), { target: { value: "New" } });

    expect(setAr).toHaveBeenCalledWith("جديد");
    expect(setEn).toHaveBeenCalledWith("New");
  });

  it("renders shared editor actions and forwards button clicks", () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();

    render(createElement(EditorActions, {
      cancelLabel: "إلغاء",
      saveLabel: "حفظ",
      onCancel,
      onSave
    }));

    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renders shared bilingual name fields with validation messages", () => {
    const setAr = vi.fn();
    const setEn = vi.fn();

    render(createElement(BilingualNameFields, {
      arValue: "منتج",
      enValue: "Product",
      arError: "الاسم العربي مطلوب",
      enError: "English name is required",
      onArChange: setAr,
      onEnChange: setEn
    }));

    fireEvent.change(screen.getByDisplayValue("منتج"), { target: { value: "جديد" } });
    fireEvent.change(screen.getByDisplayValue("Product"), { target: { value: "New" } });

    expect(setAr).toHaveBeenCalledWith("جديد");
    expect(setEn).toHaveBeenCalledWith("New");
    expect(screen.getByText("الاسم العربي مطلوب")).toBeInTheDocument();
    expect(screen.getByText("English name is required")).toBeInTheDocument();
  });

  it("renders a shared image field card with upload control and error state", () => {
    render(createElement(ImageFieldCard, {
      title: "صورة المنتج",
      error: "أضف صورة المنتج",
      uploadSlot: createElement("div", null, "image-upload-slot")
    }));

    expect(screen.getByText("صورة المنتج")).toBeInTheDocument();
    expect(screen.getByText("image-upload-slot")).toBeInTheDocument();
    expect(screen.getByText("أضف صورة المنتج")).toBeInTheDocument();
  });
});
