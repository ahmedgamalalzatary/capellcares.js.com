/** Rows-per-page choices offered by every paginated ERP list; the first is the default. */
export const PAGE_SIZES = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = PAGE_SIZES[0];

/** "Load more" stops once this many rows are on screen, and one request never returns more. */
export const MAX_VISIBLE_ROWS = 100;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  pagination: PageMeta;
}

export function isPageSize(value: unknown): value is PageSize {
  return PAGE_SIZES.includes(value as PageSize);
}

export function totalPagesOf(total: number, pageSize: number) {
  return Math.ceil(total / pageSize);
}

/** How many consecutive pages one request may cover (the page itself plus loaded-more pages). */
export function maxPagesPerRequest(pageSize: number) {
  return Math.max(1, Math.floor(MAX_VISIBLE_ROWS / pageSize));
}

export function pageMeta(total: number, page: number, pageSize: number): PageMeta {
  return { page, pageSize, total, totalPages: totalPagesOf(total, pageSize) };
}
