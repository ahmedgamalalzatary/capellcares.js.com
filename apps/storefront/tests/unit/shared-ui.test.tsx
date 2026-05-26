import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableRow
} from "@capella/shared/ui";

describe("shared UI exports", () => {
  it("renders shared button and input primitives in storefront", () => {
    render(createElement("div", null,
      createElement(Button, { type: "button" }, "Apply"),
      createElement(Input, { placeholder: "Search products" }),
      createElement(Card, null,
        createElement(CardHeader, null, createElement(CardTitle, null, "Featured")),
        createElement(CardContent, null, "Serum")
      ),
      createElement(Table, null,
        createElement(TableBody, null,
          createElement(TableRow, null, createElement(TableCell, null, "Row"))
        )
      )
    ));

    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute("data-slot", "button");
    expect(screen.getByPlaceholderText("Search products")).toHaveAttribute("data-slot", "input");
    expect(screen.getByText("Featured")).toHaveAttribute("data-slot", "card-title");
    expect(screen.getByText("Row")).toHaveAttribute("data-slot", "table-cell");
  });
});
