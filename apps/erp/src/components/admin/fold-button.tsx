"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FoldButtonProps = Omit<ComponentProps<"button">, "children" | "aria-label" | "aria-expanded"> & {
  collapsed: boolean;
  label: string;
  appearance?: "default" | "tree";
};

/** Shared fold control; tree appearance preserves the category tree's existing styling. */
export function FoldButton({ collapsed, label, appearance = "default", className, ...props }: FoldButtonProps) {
  const isTree = appearance === "tree";
  return (
    <button
      type="button"
      data-slot={isTree ? undefined : "button"}
      className={cn(isTree
        ? "grid size-8 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus pointer-coarse:size-11"
        : buttonVariants({ variant: "ghost", size: "icon-sm" }), className)}
      aria-label={label}
      aria-expanded={!collapsed}
      title={isTree ? undefined : label}
      {...props}
    >
      <ChevronDown className={cn("transition-transform duration-200", isTree && "size-4", collapsed && "rotate-180")} />
    </button>
  );
}
