import type { ComponentProps, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A button-looking label wrapping a visually hidden file input (keeps native keyboard + test access). */
export function FileButton({
  children,
  variant = "secondary",
  size = "sm",
  className,
  disabled,
  ...inputProps
}: Omit<ComponentProps<"input">, "type" | "size"> &
  VariantProps<typeof buttonVariants> & { children: ReactNode }) {
  return (
    <label
      aria-disabled={disabled || undefined}
      className={cn(
        buttonVariants({ variant, size }),
        "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
        disabled && "pointer-events-none text-icon-faint",
        className,
      )}
    >
      {children}
      <input type="file" className="sr-only" disabled={disabled} {...inputProps} />
    </label>
  );
}
