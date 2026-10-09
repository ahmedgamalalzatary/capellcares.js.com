import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BilingualEditorField } from "@/components/forms/editor-form-parts";
import { BilingualNameFields } from "@/components/forms/editor-form-parts";

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
});
