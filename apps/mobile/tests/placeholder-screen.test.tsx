import React from "react";
import { render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Phase 1 placeholder", () => {
  it("renders the shared Arabic brand string", () => {
    const { getByText } = render(<Index />);
    expect(getByText("كابيلا كير")).toBeTruthy();
  });
});
