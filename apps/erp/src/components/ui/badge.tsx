import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The tray's swatch: a coloured dot that names a state, set on a soft wash of the same hue. */
const badgeVariants = cva(
  "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-sand-150 text-text-2 [--swatch:var(--sand-500)]",
        success: "bg-success-soft text-success [--swatch:var(--success)]",
        warning: "bg-warning-soft text-warning [--swatch:var(--warning)]",
        danger: "bg-danger-soft text-danger [--swatch:var(--danger)]",
        info: "bg-info-soft text-info [--swatch:var(--info)]",
        nude: "bg-nude-soft text-nude-strong [--swatch:var(--nude-strong)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { swatch?: boolean };

export function Badge({ className, tone, swatch = true, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {swatch ? <span aria-hidden className="size-1.5 rounded-full bg-(--swatch)" /> : null}
      {children}
    </span>
  );
}

/** A bare swatch dot for dense cells (stock levels, inline states). */
const SWATCH_COLOR = {
  neutral: "bg-sand-500",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  nude: "bg-nude-strong",
} as const;

export function Swatch({ tone, className }: { tone?: BadgeTone; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", SWATCH_COLOR[tone ?? "neutral"], className)} />;
}
