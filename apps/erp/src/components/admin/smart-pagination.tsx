"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE, totalPagesOf } from "@capella/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { useMediaQuery } from "@/hooks/use-media-query";
import { clampPage, pageNumbers } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export interface SmartPaginationProps {
  page: number;
  /** Rows matching the current search and filters. */
  total: number;
  /** A server page is on its way: controls are disabled and out-of-range pages are not corrected yet. */
  loading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

const Num = ({ value }: { value: number }) => <span className="num">{formatNumber(value)}</span>;

/** The ERP's one pagination bar: where am I (start), page numbers (middle), go to a typed page (end). */
export function SmartPagination({ page, total, loading = false, onPageChange, className }: SmartPaginationProps) {
  const [typed, setTyped] = useState("");
  // Phones keep only first, current and last so the row fits beside السابق/التالي with touch-sized targets.
  const narrow = useMediaQuery("(max-width: 639px)");
  const totalPages = totalPagesOf(total);

  // A remembered page can outlive its rows (deleted items, a narrower filter): settle on the last page that exists.
  useEffect(() => {
    if (!loading && page !== clampPage(page, totalPages)) onPageChange(clampPage(page, totalPages));
  }, [loading, onPageChange, page, totalPages]);

  if (total <= PAGE_SIZE) return null;

  const goTo = (target: number) => {
    const next = clampPage(target, totalPages);
    if (next !== page) onPageChange(next);
  };

  const jump = () => {
    const value = typed.trim();
    setTyped("");
    if (/^\d+$/.test(value)) goTo(Number(value));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") jump();
  };

  return (
    <Card className={cn("mt-4 p-3 sm:p-4", className)}>
      <nav aria-label="التنقل بين الصفحات" className="flex flex-wrap items-center justify-between gap-3 max-md:justify-center">
        <p role="status" className="text-sm text-text-muted max-md:w-full max-md:text-center">
          صفحة <Num value={page} /> من <Num value={totalPages} />
        </p>

        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="sm" className="max-sm:px-2" disabled={loading || page <= 1} onClick={() => goTo(page - 1)}>
            <ChevronRight aria-hidden /> <span className="max-sm:sr-only">السابق</span>
          </Button>
          {pageNumbers(page, totalPages, narrow ? 0 : 1).map((item, index) => item === "gap" ? (
            <span key={`gap-${index}`} aria-hidden className="px-1 text-text-muted">…</span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`الصفحة ${item}`}
              aria-current={item === page ? "page" : undefined}
              disabled={loading}
              onClick={() => goTo(item)}
              className={cn(
                "num grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm font-medium transition-colors pointer-coarse:size-11",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default",
                item === page ? "bg-sand-600 text-sand-0" : "text-text-strong hover:bg-hover"
              )}
            >
              {item}
            </button>
          ))}
          <Button variant="secondary" size="sm" className="max-sm:px-2" disabled={loading || page >= totalPages} onClick={() => goTo(page + 1)}>
            <span className="max-sm:sr-only">التالي</span> <ChevronLeft aria-hidden />
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-muted">
          صفحة
          <Input
            aria-label="الانتقال إلى صفحة"
            inputMode="numeric"
            className="num h-8 w-20 text-center text-sm pointer-coarse:h-11"
            placeholder={`${page}/${totalPages}`}
            value={typed}
            disabled={loading}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={jump}
          />
        </label>
      </nav>
    </Card>
  );
}
