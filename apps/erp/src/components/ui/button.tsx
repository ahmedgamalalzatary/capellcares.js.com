import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium",
    "transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:text-icon-faint",
    "[&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "disabled:bg-sand-150 disabled:shadow-none bg-sand-900 text-sand-50 shadow-[0_1px_2px_oklch(0.2_0.01_82/0.25)] hover:bg-sand-950",
        secondary: "disabled:bg-sunken bg-surface text-text-strong shadow-[0_0_0_1px_var(--line-control)] hover:bg-hover hover:shadow-[0_0_0_1px_var(--line-strong)]",
        ghost: "text-text-2 hover:bg-hover hover:text-text-strong",
        danger: "disabled:bg-sand-150 bg-danger text-on-danger hover:bg-danger/90",
        "danger-ghost": "text-danger hover:bg-danger-soft",
      },
      size: {
        sm: "h-8 px-3 text-sm [&_svg]:size-4",
        md: "h-10 px-4 text-base pointer-coarse:h-11",
        lg: "h-11 px-5 text-base",
        icon: "size-10 pointer-coarse:size-11",
        "icon-sm": "size-8 pointer-coarse:size-11 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
