"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  index: number;
  count: number;
  onMove: (index: number, delta: -1 | 1) => void;
  disabled?: boolean;
  orientation?: "row" | "column";
  className?: string;
}

/** Up/down reorder control shared by list tables and form rows; disabled at both ends. */
export function ReorderButtons({ index, count, onMove, disabled = false, orientation = "row", className }: Props) {
  return (
    <div className={cn("flex items-center", orientation === "column" && "flex-col", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="تحريك لأعلى"
        title="تحريك لأعلى"
        disabled={disabled || index <= 0}
        onClick={() => onMove(index, -1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="تحريك لأسفل"
        title="تحريك لأسفل"
        disabled={disabled || index < 0 || index >= count - 1}
        onClick={() => onMove(index, 1)}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
