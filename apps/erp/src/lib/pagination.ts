import { PAGE_SIZE } from "@capella/shared";
import type { SortState } from "@/lib/table-sort";

export type PageItem = number | "gap";

/** First, last, the current page and `siblings` pages on each side of it; a gap stands for two or more hidden pages, never just one. */
export function pageNumbers(current: number, totalPages: number, siblings = 1): PageItem[] {
  if (totalPages < 1) return [];
  const around = Array.from({ length: siblings * 2 + 1 }, (_, index) => current - siblings + index);
  const shown = [...new Set([1, ...around, totalPages])]
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

/** The rows of `page` within a full list. */
export function pageSlice<T>(rows: T[], page: number) {
  return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
  q: string;
  sort: SortState<S> | null;
  filters: Record<F, string>;
}

export function defaultListState<F extends string, S extends string>(schema: ListSchema<F, S>): ListState<F, S> {
  return { page: 1, q: "", sort: null, filters: defaultFilters(schema) };
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
  const sortKey = params.get("sort");
  const filters = defaultFilters(schema);
  for (const key of Object.keys(schema.filters) as F[]) {
    const value = params.get(key);
    if (value != null && accepted(schema.filters[key], value)) filters[key] = value;
  }
  return {
    page: wholeNumber(params.get("page"), 1) ?? 1,
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
