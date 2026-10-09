import type { ComponentProps, ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data table inside a well. Below `md` every row reflows into a stacked card:
 * the cell marked `data-cell="lead"` spans the top, `data-cell="actions"` becomes the card's bottom bar,
 * and the remaining cells read as label/value pairs from their `data-label`.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div data-slot="table-scroll" className="min-w-0 overflow-x-auto">
      <table data-slot="table" className={cn("w-full border-collapse text-start text-base", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("max-md:sr-only", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("max-md:grid max-md:gap-2 max-md:p-2", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150 md:border-b md:border-line md:last:border-b-0 md:hover:bg-sunken",
        "max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-3 max-md:rounded-control max-md:bg-surface max-md:p-4 max-md:shadow-[0_0_0_1px_var(--line)]",
        className,
      )}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "h-11 whitespace-nowrap bg-sunken px-4 text-start align-middle text-xs font-medium text-text-muted first:ps-5 last:pe-5",
        "border-b border-line",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A header cell that sorts its column. Clicking cycles ascending → descending → original order;
 * `aria-sort` tells assistive tech the current state.
 */
export function SortableTH({
  children,
  direction,
  onSort,
  className,
}: {
  children: ReactNode;
  direction: "asc" | "desc" | null;
  onSort: () => void;
  className?: string;
}) {
  const Indicator = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TH aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"} className={className}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "group -mx-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-hover hover:text-text-strong",
          direction && "text-text-strong",
        )}
      >
        {children}
        <Indicator
          aria-hidden
          className={cn("size-3.5 shrink-0", direction ? "text-nude-strong" : "text-icon-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}
        />
      </button>
    </TH>
  );
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle first:ps-5 last:pe-5",
        // Stacked (phone) layout
        "max-md:flex max-md:min-w-0 max-md:flex-col max-md:items-start max-md:gap-0.5 max-md:p-0 max-md:first:ps-0 max-md:last:pe-0",
        "max-md:before:text-xs max-md:before:text-text-muted max-md:before:content-[attr(data-label)]",
        "max-md:data-[cell=lead]:col-span-2 max-md:data-[cell=lead]:items-stretch max-md:data-[cell=lead]:before:hidden",
        "max-md:data-[cell=actions]:col-span-2 max-md:data-[cell=actions]:-mx-2 max-md:data-[cell=actions]:-mb-2 max-md:data-[cell=actions]:items-stretch max-md:data-[cell=actions]:border-t max-md:data-[cell=actions]:border-line max-md:data-[cell=actions]:pt-1 max-md:data-[cell=actions]:before:hidden max-md:data-[cell=actions]:empty:hidden",
        className,
      )}
      {...props}
    />
  );
}

/** Full-width row for empty / loading / error states. */
export function TableState({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr className="max-md:block">
      <td colSpan={colSpan} className="max-md:block">{children}</td>
    </tr>
  );
}
