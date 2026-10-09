"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The chevron toggle that folds/unfolds a shop-media section or item. */
export function FoldButton({ collapsed, onClick, label }: { collapsed: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      onClick={onClick}
    >
      <ChevronDown className={cn("transition-transform duration-200", collapsed && "rotate-180")} />
    </Button>
  );
}
