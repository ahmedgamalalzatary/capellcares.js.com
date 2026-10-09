"use client";

import { Check } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface StepItem {
  id: string;
  label: string;
  /** done = all required data there; missing = required data missing (shown once visited or in edit mode). */
  state: "done" | "missing" | "todo";
}

/**
 * Wizard header. Steps sit in equal columns and the progress rule spans exactly those columns, so its
 * edge always ends at the step being viewed. Reachable steps are buttons (all of them when editing,
 * visited ones when creating). Labels hide on phones; the step card's title names the current step.
 */
export function Stepper({
  steps,
  current,
  isReachable,
  onSelect,
}: {
  steps: StepItem[];
  current: number;
  isReachable: (index: number) => boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="خطوات النموذج" className="rounded-well bg-surface px-3 pt-4 pb-3 shadow-well sm:px-5">
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full bg-sand-900" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const isCurrent = index === current;
          const reachable = isReachable(index);
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!reachable || isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                data-testid={`step-${step.id}`}
                onClick={() => onSelect(index)}
                className={cn(
                  "flex h-10 w-full min-w-0 items-center gap-2 rounded-control px-1.5 text-sm transition-colors max-md:justify-center pointer-coarse:h-11",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  "enabled:hover:bg-hover disabled:cursor-default",
                  isCurrent ? "font-bold text-text-strong" : reachable ? "text-text-2" : "text-text-muted",
                )}
              >
                <span
                  className={cn(
                    "num relative grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium",
                    isCurrent
                      ? "bg-sand-900 text-sand-50"
                      : step.state === "done" && reachable
                        ? "bg-success-soft text-success"
                        : "bg-surface text-text-2 shadow-[0_0_0_1px_var(--line-control)]",
                  )}
                >
                  {step.state === "done" && reachable && !isCurrent ? <Check aria-hidden className="size-3.5" /> : formatNumber(index + 1)}
                  {step.state === "missing" && !isCurrent ? (
                    <span aria-hidden className="absolute -top-0.5 -end-0.5 size-2.5 rounded-full bg-warning ring-2 ring-surface" />
                  ) : null}
                </span>
                <span className="truncate max-md:sr-only">{step.label}</span>
                {step.state === "missing" ? <span className="sr-only">(بيانات ناقصة)</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "الخطوة 2 من 5" — shown in the step card's header. */
export function StepCount({ current, total }: { current: number; total: number }) {
  return (
    <span className="text-sm text-text-muted">
      الخطوة <span className="num">{formatNumber(current + 1)}</span> من <span className="num">{formatNumber(total)}</span>
    </span>
  );
}
