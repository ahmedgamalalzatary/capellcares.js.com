import { DEFAULT_PAGE_SIZE, isPageSize, MAX_VISIBLE_ROWS, maxPagesPerRequest, totalPagesOf, type PageSize } from "@capella/shared";
import type { SortState } from "@/lib/table-sort";

export type PageItem = number | "gap";

/** First, last and the pages beside the current one; a gap stands for two or more hidden pages, never just one. */
export function pageNumbers(current: number, totalPages: number): PageItem[] {
  if (totalPages < 1) return [];
  const shown = [...new Set([1, current - 1, current, current + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];
  shown.forEach((page, index) => {
    const previous = shown[index - 1];
    if (previous != null && page - previous === 2) items.push(previous + 1);
    else if (previous != null && page - previous > 2) items.push("gap");
    items.push(page);
  });
  return items;
}

export function clampPage(page: number, totalPages: number) {
  const whole = Number.isFinite(page) ? Math.trunc(page) : 1;
  return Math.min(Math.max(whole, 1), Math.max(totalPages, 1));
}

/** Where the list is: `page` plus `more` loaded-more pages after it. */
export interface PageWindow {
  page: number;
  more: number;
  pageSize: number;
  total: number;
}

export function visibleRange({ page, more, pageSize, total }: PageWindow) {
  const totalPages = totalPagesOf(total, pageSize);
  return {
    firstPage: page,
    lastPage: Math.min(page + more, Math.max(totalPages, 1)),
    totalPages,
    fromRow: total > 0 ? (page - 1) * pageSize + 1 : 0,
    toRow: Math.min((page + more) * pageSize, total)
  };
}

/** One more page fits while the next page exists and the screen stays within the visible-row limit. */
export function canLoadMore(window: PageWindow) {
  const { lastPage, totalPages } = visibleRange(window);
  return lastPage < totalPages && (window.more + 2) * window.pageSize <= MAX_VISIBLE_ROWS;
}

export interface ListFilterSchema {
  default: string;
  /** The only accepted values; omit to use `accepts` (or to accept any value). */
  values?: readonly string[];
  accepts?: (value: string) => boolean;
}

export interface ListSchema<F extends string, S extends string> {
  filters: Record<F, ListFilterSchema>;
  sortKeys: readonly S[];
}

export interface ListState<F extends string, S extends string> {
  page: number;
  size: PageSize;
  more: number;
  q: string;
  sort: SortState<S> | null;
  filters: Record<F, string>;
}

export function defaultListState<F extends string, S extends string>(schema: ListSchema<F, S>): ListState<F, S> {
  return { page: 1, size: DEFAULT_PAGE_SIZE, more: 0, q: "", sort: null, filters: defaultFilters(schema) };
}

function defaultFilters<F extends string, S extends string>(schema: ListSchema<F, S>) {
  return Object.fromEntries(
    Object.entries<ListFilterSchema>(schema.filters).map(([key, filter]) => [key, filter.default])
  ) as Record<F, string>;
}

function accepted(filter: ListFilterSchema, value: string) {
  if (filter.values) return filter.values.includes(value);
  return filter.accepts ? filter.accepts(value) : true;
}

function wholeNumber(value: string | null, min: number) {
  if (value == null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= min ? parsed : null;
}

/** Reads a list's state from the address; anything missing or invalid falls back to its default. */
export function parseListState<F extends string, S extends string>(params: URLSearchParams, schema: ListSchema<F, S>): ListState<F, S> {
  const sizeParam = Number(params.get("size"));
  const size = isPageSize(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;
  const sortKey = params.get("sort");
  const filters = defaultFilters(schema);
  for (const key of Object.keys(schema.filters) as F[]) {
    const value = params.get(key);
    if (value != null && accepted(schema.filters[key], value)) filters[key] = value;
  }
  return {
    page: wholeNumber(params.get("page"), 1) ?? 1,
    size,
    more: Math.min(wholeNumber(params.get("more"), 0) ?? 0, maxPagesPerRequest(size) - 1),
    q: params.get("q")?.trim() ?? "",
    sort: sortKey && schema.sortKeys.includes(sortKey as S)
      ? { key: sortKey as S, direction: params.get("dir") === "desc" ? "desc" : "asc" }
      : null,
    filters
  };
}

/** Writes a list's state to the address, leaving out everything that equals its default. */
export function serializeListState<F extends string, S extends string>(state: ListState<F, S>, schema: ListSchema<F, S>) {
  const params = new URLSearchParams();
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.size !== DEFAULT_PAGE_SIZE) params.set("size", String(state.size));
  if (state.more > 0) params.set("more", String(state.more));
  const q = state.q.trim();
  if (q) params.set("q", q);
  if (state.sort) {
    params.set("sort", state.sort.key);
    params.set("dir", state.sort.direction);
  }
  for (const key of Object.keys(schema.filters) as F[]) {
    if (state.filters[key] !== schema.filters[key].default) params.set(key, state.filters[key]);
  }
  return params;
}
