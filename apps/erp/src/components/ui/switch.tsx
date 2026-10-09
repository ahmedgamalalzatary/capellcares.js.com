"use client";

import { useId, type ReactNode } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Ink track (inverts in dark mode) with a thumb that slides toward the reading end. */
export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-sand-400 p-0.5 transition-colors duration-150",
        "data-[state=checked]:bg-sand-900",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-5 rounded-full bg-sand-0 shadow-[0_1px_2px_oklch(0.2_0.01_82/0.3)] transition-[margin] duration-150 ease-out",
          "data-[state=checked]:ms-4",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

/** A labelled switch row; the whole row is the hit target. */
export function SwitchField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  className,
  testId,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} data-testid={testId} className="mt-0.5" />
      <label htmlFor={id} className="grid min-w-0 cursor-pointer gap-0.5">
        <span className="text-base font-medium text-text-strong">{label}</span>
        {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
      </label>
    </div>
  );
}
