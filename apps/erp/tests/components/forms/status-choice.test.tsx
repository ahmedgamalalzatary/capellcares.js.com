import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusChoice } from "@/components/forms/status-choice";

const options = [
  { value: "inactive", label: "مسودة", hint: "مخفي عن المتجر", tone: "neutral" },
  { value: "active", label: "نشط", hint: "يظهر في المتجر", tone: "success" }
] as const;

afterEach(cleanup);

describe("StatusChoice", () => {
  it("renders a radio per option with its hint and checks the current value", () => {
    render(<StatusChoice name="x-status" value="inactive" onChange={vi.fn()} legend="حالة" options={options} />);

    expect(screen.getByRole("radio", { name: /مسودة/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /نشط/ })).not.toBeChecked();
    expect(screen.getByText("مخفي عن المتجر")).toBeInTheDocument();
    expect(screen.getByText("يظهر في المتجر")).toBeInTheDocument();
  });

  it("calls onChange with the chosen value", () => {
    const onChange = vi.fn();
    render(<StatusChoice name="x-status" value="inactive" onChange={onChange} legend="حالة" options={options} />);

    fireEvent.click(screen.getByRole("radio", { name: /نشط/ }));

    expect(onChange).toHaveBeenCalledWith("active");
  });
});
