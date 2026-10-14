"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Paged, PageSize } from "@capella/shared";
import { api } from "@/lib/api/client";
import type { SmartPaginationProps } from "@/components/admin/smart-pagination";
import { defaultListState, parseListState, serializeListState, type ListSchema, type ListState } from "@/lib/pagination";
import { nextSort, sortRows, type SortAccessors, type SortState } from "@/lib/table-sort";

const BASE_KEYS = ["page", "size", "more", "q", "sort", "dir"];
const sessionKey = (listId: string) => `capella-erp-list:${listId}`;

function readSession(listId: string) {
  try {
    return sessionStorage.getItem(sessionKey(listId));
  } catch {
    return null;
  }
}

function writeSession(listId: string, value: string) {
  try {
    sessionStorage.setItem(sessionKey(listId), value);
  } catch {
    // Private mode or blocked storage: the address still remembers the view.
  }
}

interface Options<F extends string, S extends string> {
  /** Names this list's remembered view in the browser session. */
  listId: string;
  /** Module-level constant: the list's filters and sortable columns. */
  schema: ListSchema<F, S>;
  /** Milliseconds to wait after typing before searching (use it for server-side search). */
  searchDelay?: number;
  /** Prefix for this list's address keys when a page shows more than one list (e.g. "best_" → best_page). */
  paramPrefix?: string;
  /** Server params for the filters when they differ from the address (default: every non-default filter as is). */
  toRequest?: (filters: Record<F, string>) => Record<string, string | undefined>;
}

/**
 * The one owner of a list's search, filters, sort, page, rows per page and loaded-more pages.
 * Restores from the address, else the browser-session copy, and keeps both in step. Any change other
 * than moving between pages goes back to page 1.
 */
export function usePaginatedList<F extends string, S extends string>({
  listId,
  schema,
  searchDelay = 0,
  paramPrefix = "",
  toRequest
}: Options<F, S>) {
  const [state, setState] = useState<ListState<F, S>>(() => defaultListState(schema));
  const [searchInput, setSearchInput] = useState("");
  const [ready, setReady] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listKeys = useMemo(() => [...BASE_KEYS, ...Object.keys(schema.filters)], [schema]);

  // Restore once per list, before the first paint and after hydration (the server render has no address or session).
  // Keyed on the list's identity only, so a schema declared inline can't re-restore and wipe the viewer's changes.
  useLayoutEffect(() => {
    const address = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();
    for (const key of listKeys) {
      const value = address.get(`${paramPrefix}${key}`);
      if (value != null) params.set(key, value);
    }
    const fromAddress = params.size > 0;
    const restored = parseListState(fromAddress ? params : new URLSearchParams(readSession(listId) ?? ""), schema);
    setState(restored);
    setSearchInput(restored.q);
    setReady(true);
  }, [listId, paramPrefix]);

  useEffect(() => {
    if (!ready) return;
    const own = serializeListState(state, schema);
    const params = new URLSearchParams(window.location.search);
    listKeys.forEach((key) => params.delete(`${paramPrefix}${key}`));
    own.forEach((value, key) => params.append(`${paramPrefix}${key}`, value));
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", url);
    }
    writeSession(listId, own.toString());
  }, [listId, listKeys, paramPrefix, ready, schema, state]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  /** Applies a change that shows a different set of rows, so the view starts again from page 1. */
  const restart = useCallback((change: (current: ListState<F, S>) => Partial<ListState<F, S>>) => {
    setState((current) => ({ ...current, ...change(current), page: 1, more: 0 }));
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const apply = () => setState((current) => current.q === value.trim() ? current : { ...current, q: value.trim(), page: 1, more: 0 });
    if (searchDelay > 0) searchTimer.current = setTimeout(apply, searchDelay);
    else apply();
  }, [searchDelay]);

  const setFilter = useCallback((key: F, value: string) => {
    restart((current) => ({ filters: { ...current.filters, [key]: value } }));
  }, [restart]);

  const setSort = useCallback((sort: SortState<S> | null) => restart(() => ({ sort })), [restart]);
  const toggleSort = useCallback((key: S) => restart((current) => ({ sort: nextSort(current.sort, key) })), [restart]);
  const setSize = useCallback((size: PageSize) => restart(() => ({ size })), [restart]);
  const setPage = useCallback((page: number) => setState((current) => ({ ...current, page, more: 0 })), []);
  const loadMore = useCallback(() => setState((current) => ({ ...current, more: current.more + 1 })), []);

  const { page, size, more } = state;
  const pageOf = useCallback(<T,>(rows: T[]) => rows.slice((page - 1) * size, (page + more) * size), [page, size, more]);

  /** Paging part of a server request: the page, its size and how many pages it spans. */
  const pageQuery = useMemo(
    () => new URLSearchParams({ page: String(page), pageSize: String(size), pages: String(more + 1) }).toString(),
    [more, page, size]
  );

  /** Query string for a server-paged list: the paging part, then search, sort and non-default filters. */
  const requestQuery = useMemo(() => {
    const params = new URLSearchParams(pageQuery);
    const own = serializeListState(state, schema);
    for (const key of ["q", "sort", "dir"]) {
      const value = own.get(key);
      if (value != null) params.set(key, value);
    }
    const filters = toRequest
      ? toRequest(state.filters)
      : Object.fromEntries(Object.keys(schema.filters).map((key) => [key, own.get(key) ?? undefined]));
    for (const [key, value] of Object.entries(filters)) {
      if (value != null && value !== "") params.set(key, value);
    }
    return params.toString();
  }, [pageQuery, schema, state, toRequest]);

  /** Props for `<SmartPagination>` once the list knows how many rows match. */
  const paginationProps = useCallback((total: number, loading = false): SmartPaginationProps => ({
    page, more, pageSize: size, total, loading, onPageChange: setPage, onPageSizeChange: setSize, onLoadMore: loadMore
  }), [loadMore, more, page, setPage, setSize, size]);

  return {
    ready, state, searchInput, setSearch, setFilter, setSort, toggleSort, setSize, setPage, loadMore, pageOf, pageQuery, requestQuery, paginationProps
  };
}

/** A sortable, paginated table whose rows are all on the page already (no search or filters). */
export function useLocalList<T, K extends string>(rows: T[], accessors: SortAccessors<T, K>, options: Options<never, K>) {
  const list = usePaginatedList(options);
  const sorted = useMemo(() => sortRows(rows, accessors, list.state.sort), [accessors, list.state.sort, rows]);
  return {
    sort: list.state.sort,
    toggleSort: list.toggleSort,
    sortedRows: list.pageOf(sorted),
    total: sorted.length,
    paginationProps: list.paginationProps
  };
}

/**
 * One page of a server-paged list. `path` is the endpoint plus its query (`null` waits, e.g. until the list has
 * restored its state). The previous rows and total stay while the next page loads, so the table and the
 * pagination bar don't jump; a slower, older answer never overwrites a newer one.
 */
export function useServerPage<T>(path: string | null, options: { onError?: (error: unknown) => void } = {}) {
  const [data, setData] = useState<{ items: T[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const latest = useRef(0);
  const onError = useRef(options.onError);
  useEffect(() => {
    onError.current = options.onError;
  });

  const load = useCallback(async () => {
    if (path == null) return;
    const request = ++latest.current;
    setLoading(true);
    setError(false);
    try {
      const page = await api.get<Paged<T>>(path);
      if (request === latest.current) setData({ items: page.items, total: page.pagination.total });
    } catch (failure) {
      if (request === latest.current) {
        setError(true);
        onError.current?.(failure);
      }
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...data, loading, error, reload: load };
}
