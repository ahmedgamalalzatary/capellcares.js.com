import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@minikoshk/shared/ui";

describe("shared UI exports", () => {
  it("renders shared badge and label primitives in ERP", () => {
    render(createElement("div", null,
      createElement(Label, { htmlFor: "sku" }, "SKU"),
      createElement(Badge, { variant: "outline" }, "Draft"),
      createElement(Select, null,
        createElement(SelectTrigger, { "aria-label": "Status" }, createElement(SelectValue, { placeholder: "Choose" })),
        createElement(SelectContent, null, createElement(SelectItem, { value: "draft" }, "Draft"))
      )
    ));

    expect(screen.getByText("SKU")).toHaveAttribute("data-slot", "label");
    const drafts = screen.getAllByText("Draft");
    const badge = drafts.find((el) => el.getAttribute("data-slot") === "badge");
    expect(badge).toBeTruthy();
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveAttribute("data-slot", "select-trigger");
  });
});
