import { z } from "zod";
import { DEFAULT_PAGE_SIZE, isPageSize, maxPagesPerRequest } from "@capella/shared";

const MAX_SEARCH_LENGTH = 100;

const wholeNumber = (min: number) => z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min));

/**
 * Query schema for a server-paged ERP list: page, rows per page (20/50/100), how many pages one request spans
 * (load more, at most 100 rows), search, a whitelisted sort column and direction, plus the list's own filters.
 * Unknown params are rejected so a typo never silently returns the unfiltered list.
 */
export function pagedQuerySchema<S extends string, F extends z.ZodRawShape>(sortKeys: readonly S[], filters: F) {
  const paging = z.object({
    page: wholeNumber(1).default("1"),
    pageSize: wholeNumber(1).refine(isPageSize, "pageSize must be 20, 50 or 100").default(String(DEFAULT_PAGE_SIZE)),
    pages: wholeNumber(1).default("1"),
    q: z.string().trim().max(MAX_SEARCH_LENGTH).transform((value) => value || undefined).optional(),
    sort: (sortKeys.length > 0 ? z.enum(sortKeys as [S, ...S[]]) : z.never()).optional(),
    dir: z.enum(["asc", "desc"]).default("asc")
  });
  return paging.extend(filters).strict().refine(
    // Zod can't see through the generic `filters` spread, so name the two paging fields this check reads.
    (query) => {
      const { pages, pageSize } = query as unknown as { pages: number; pageSize: number };
      return pages <= maxPagesPerRequest(pageSize);
    },
    { message: "A request can return at most 100 rows", path: ["pages"] }
  );
}

/** SQL LIMIT/OFFSET for a page plus the pages loaded under it. */
export function pageWindow({ page, pageSize, pages }: { page: number; pageSize: number; pages: number }) {
  return { limit: pageSize * pages, offset: (page - 1) * pageSize };
}

/** A LIKE pattern matching `term` anywhere, with LIKE's own wildcards taken literally. */
export function likeContains(term: string) {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
