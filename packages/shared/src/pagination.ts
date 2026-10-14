/** Rows per page on every paginated ERP list. */
export const PAGE_SIZE = 20;

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

export function totalPagesOf(total: number, pageSize = PAGE_SIZE) {
  return Math.ceil(total / pageSize);
}

export function pageMeta(total: number, page: number, pageSize = PAGE_SIZE): PageMeta {
  return { page, pageSize, total, totalPages: totalPagesOf(total, pageSize) };
}
