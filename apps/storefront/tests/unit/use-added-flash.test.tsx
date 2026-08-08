import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAddedFlash } from "@/hooks/use-added-flash";

function Probe({ durationMs }: { durationMs?: number }) {
  const { added, flash } = useAddedFlash(durationMs);
  return createElement(
    "button",
    { onClick: flash },
    added ? "added" : "idle"
  );
}

function renderProbe(durationMs?: number) {
  return render(createElement(Probe, { durationMs }));
}

const label = () => screen.getByRole("button").textContent;

afterEach(() => {
  vi.useRealTimers();
});

describe("useAddedFlash", () => {
  it("starts idle and turns on for the flash window", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderProbe();

    expect(label()).toBe("idle");

    fireEvent.click(screen.getByRole("button"));

    expect(label()).toBe("added");
  });

  it("falls back to idle once the window passes", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderProbe(1600);

    fireEvent.click(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(1599);
    });
    expect(label()).toBe("added");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(label()).toBe("idle");
  });

  it("restarts the window on a second flash instead of stacking timers", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderProbe(1600);

    fireEvent.click(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole("button"));

    // The first timer would have fired here; the second flash must have replaced it.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(label()).toBe("added");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(label()).toBe("idle");
  });

  it("clears a pending timer when the component unmounts", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = renderProbe(1600);
    fireEvent.click(screen.getByRole("button"));

    // Pin the flash timer specifically — React schedules timers of its own.
    const flashIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 1600);
    expect(flashIndex).toBeGreaterThan(-1);
    const flashTimer = setTimeoutSpy.mock.results[flashIndex]!.value;

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(flashTimer);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
