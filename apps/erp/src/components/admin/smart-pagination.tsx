"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_PAGE_SIZE, isPageSize, PAGE_SIZES, type PageSize } from "@capella/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { canLoadMore, clampPage, pageNumbers, visibleRange } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export interface SmartPaginationProps {
  page: number;
  /** Pages loaded under `page` with "تحميل المزيد". */
  more: number;
  pageSize: PageSize;
  /** Rows matching the current search and filters. */
  total: number;
  /** A server page is on its way: controls are disabled and out-of-range pages are not corrected yet. */
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  onLoadMore: () => void;
  className?: string;
}

const Num = ({ value }: { value: number }) => <span className="num">{formatNumber(value)}</span>;

/** The ERP's one pagination bar: load more on top; where-am-I + rows per page, page numbers, and go-to-page below. */
export function SmartPagination({
  page,
  more,
  pageSize,
  total,
  loading = false,
  onPageChange,
  onPageSizeChange,
  onLoadMore,
  className
}: SmartPaginationProps) {
  const [typed, setTyped] = useState("");
  const view = { page, more, pageSize, total };
  const { lastPage, totalPages } = visibleRange(view);

  // A remembered page can outlive its rows (deleted items, a narrower filter): settle on the last page that exists.
  useEffect(() => {
    if (!loading && page !== clampPage(page, totalPages)) onPageChange(clampPage(page, totalPages));
  }, [loading, onPageChange, page, totalPages]);

  if (total <= DEFAULT_PAGE_SIZE) return null;

  const goTo = (target: number) => {
    if (target !== page || more > 0) onPageChange(clampPage(target, totalPages));
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
    <Card className={cn("mt-4 grid gap-3 p-3 sm:p-4", className)}>
      <nav aria-label="التنقل بين الصفحات" className="contents">
        {canLoadMore(view) ? (
          <Button className="w-full" disabled={loading} onClick={onLoadMore}>تحميل المزيد</Button>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 max-md:justify-center">
          <div className="flex items-center gap-3 max-md:w-full max-md:justify-between">
            <p role="status" className="text-sm text-text-muted">
              {more > 0
                ? <>الصفحات <Num value={page} />–<Num value={lastPage} /> من <Num value={totalPages} /></>
                : <>صفحة <Num value={page} /> من <Num value={totalPages} /></>}
            </p>
            <Select
              aria-label="عدد الصفوف في الصفحة"
              value={pageSize}
              disabled={loading}
              onChange={(event) => {
                const size = Number(event.target.value);
                if (isPageSize(size)) onPageSizeChange(size);
              }}
            >
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} لكل صفحة</option>)}
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1">
            <Button variant="ghost" size="sm" disabled={loading || page <= 1} onClick={() => goTo(page - 1)}>
              <ChevronRight aria-hidden /> السابق
            </Button>
            {pageNumbers(page, totalPages).map((item, index) => item === "gap" ? (
              <span key={`gap-${index}`} aria-hidden className="px-1 text-text-muted">…</span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`الصفحة ${item}`}
                aria-current={item >= page && item <= lastPage ? "page" : undefined}
                disabled={loading}
                onClick={() => goTo(item)}
                className={cn(
                  "num grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm font-medium transition-colors pointer-coarse:size-11",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-default",
                  item >= page && item <= lastPage
                    ? "bg-sand-600 text-sand-0"
                    : "text-text-strong hover:bg-hover"
                )}
              >
                {item}
              </button>
            ))}
            <Button variant="secondary" size="sm" disabled={loading || lastPage >= totalPages} onClick={() => goTo(lastPage + 1)}>
              التالي <ChevronLeft aria-hidden />
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
        </div>
      </nav>
    </Card>
  );
}
