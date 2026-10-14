import { z } from "zod";
import { PAGE_SIZE } from "@capella/shared";

const MAX_SEARCH_LENGTH = 100;

/**
 * Query schema for a server-paged ERP list: page, search, a whitelisted sort column and direction, plus the list's own
 * filters. Pages are always PAGE_SIZE rows. Unknown params are rejected so a typo never silently returns the
 * unfiltered list.
 */
export function pagedQuerySchema<S extends string, F extends z.ZodRawShape>(sortKeys: readonly S[], filters: F) {
  return z.object({
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).default("1"),
    q: z.string().trim().max(MAX_SEARCH_LENGTH).transform((value) => value || undefined).optional(),
    sort: (sortKeys.length > 0 ? z.enum(sortKeys as [S, ...S[]]) : z.never()).optional(),
    dir: z.enum(["asc", "desc"]).default("asc")
  }).extend(filters).strict();
}

/** SQL LIMIT/OFFSET for a page. */
export function pageWindow(page: number, pageSize = PAGE_SIZE) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

/** A LIKE pattern matching `term` anywhere, with LIKE's own wildcards taken literally. */
export function likeContains(term: string) {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
