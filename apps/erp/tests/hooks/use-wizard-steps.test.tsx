import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWizardSteps, type WizardRequirement, type WizardStep } from "@/hooks/use-wizard-steps";

const STEPS: WizardStep[] = [
  { id: "a", label: "أ" },
  { id: "b", label: "ب" },
  { id: "c", label: "ج" }
];

const requirements = (ok: Record<string, boolean>): WizardRequirement[] => [
  { key: "a1", target: "a", ok: ok.a1 },
  { key: "b1", target: "b", ok: ok.b1 }
];

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});

describe("useWizardSteps", () => {
  it("blocks next when the current step's requirement is unmet", () => {
    const check = vi.fn(() => false);
    const { result } = renderHook(() => useWizardSteps({
      steps: STEPS,
      requirements: requirements({ a1: false, b1: true }),
      checkRequirements: check
    }));

    act(() => result.current.next());

    expect(result.current.step).toBe(0);
    expect(check).toHaveBeenCalledWith(["a1"]);
  });

  it("advances when the requirement is met", () => {
    const { result } = renderHook(() => useWizardSteps({
      steps: STEPS,
      requirements: requirements({ a1: true, b1: true }),
      checkRequirements: () => true
    }));

    act(() => result.current.next());

    expect(result.current.step).toBe(1);
    expect(result.current.current.id).toBe("b");
  });

  it("skips validation when editing", () => {
    const check = vi.fn(() => false);
    const { result } = renderHook(() => useWizardSteps({
      steps: STEPS,
      requirements: requirements({ a1: false, b1: false }),
      editing: true,
      checkRequirements: check
    }));

    expect(result.current.step).toBe(0);
    act(() => result.current.next());

    expect(result.current.step).toBe(1);
    expect(check).not.toHaveBeenCalled();
  });

  it("never decreases reached", () => {
    const { result } = renderHook(() => useWizardSteps({
      steps: STEPS,
      requirements: requirements({ a1: true, b1: true }),
      checkRequirements: () => true
    }));

    act(() => result.current.goTo(2));
    expect(result.current.reached).toBe(2);
    act(() => result.current.goTo(0));
    expect(result.current.reached).toBe(2);
  });

  it("marks done, missing and todo step states", () => {
    const { result } = renderHook(() => useWizardSteps({
      steps: STEPS,
      requirements: requirements({ a1: true, b1: false }),
      checkRequirements: () => true
    }));

    expect(result.current.stepItems.map((item) => item.state)).toEqual(["todo", "todo", "todo"]);

    act(() => result.current.goTo(1));

    expect(result.current.stepItems.map((item) => item.state)).toEqual(["done", "todo", "todo"]);
  });
});
