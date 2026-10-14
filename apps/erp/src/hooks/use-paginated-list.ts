"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PageSize } from "@capella/shared";
import { defaultListState, parseListState, serializeListState, type ListSchema, type ListState } from "@/lib/pagination";
import { nextSort, type SortState } from "@/lib/table-sort";

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
}

/**
 * The one owner of a list's search, filters, sort, page, rows per page and loaded-more pages.
 * Restores from the address, else the browser-session copy, and keeps both in step. Any change other
 * than moving between pages goes back to page 1.
 */
export function usePaginatedList<F extends string, S extends string>({ listId, schema, searchDelay = 0 }: Options<F, S>) {
  const [state, setState] = useState<ListState<F, S>>(() => defaultListState(schema));
  const [searchInput, setSearchInput] = useState("");
  const [ready, setReady] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listKeys = useMemo(() => [...BASE_KEYS, ...Object.keys(schema.filters)], [schema]);

  // Restore before the first paint, after hydration (the server render has no address or session).
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromAddress = listKeys.some((key) => params.has(key));
    const restored = parseListState(fromAddress ? params : new URLSearchParams(readSession(listId) ?? ""), schema);
    setState(restored);
    setSearchInput(restored.q);
    setReady(true);
  }, [listId, listKeys, schema]);

  useEffect(() => {
    if (!ready) return;
    const own = serializeListState(state, schema);
    const params = new URLSearchParams(window.location.search);
    listKeys.forEach((key) => params.delete(key));
    own.forEach((value, key) => params.append(key, value));
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", url);
    }
    writeSession(listId, own.toString());
  }, [listId, listKeys, ready, schema, state]);

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

  /** Query string for a server-paged list: the page, its size, how many pages it spans, then search, sort and non-default filters. */
  const requestQuery = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(size), pages: String(more + 1) });
    const own = serializeListState(state, schema);
    for (const key of ["q", "sort", "dir", ...Object.keys(schema.filters)]) {
      const value = own.get(key);
      if (value != null) params.set(key, value);
    }
    return params.toString();
  }, [more, page, schema, size, state]);

  return { ready, state, searchInput, setSearch, setFilter, setSort, toggleSort, setSize, setPage, loadMore, pageOf, requestQuery };
}
