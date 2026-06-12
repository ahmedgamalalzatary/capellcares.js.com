"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/errors";

/**
 * Draft up/down reordering over a persisted id order. The draft resets whenever
 * the persisted order changes (e.g. after a refetch).
 */
export function useListReorder(input: {
  persistedIds: number[];
  save: (ids: number[]) => Promise<void>;
  successMessage: string;
  errorMessage: string;
}) {
  const { persistedIds, save, successMessage, errorMessage } = input;
  const [draft, setDraft] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);

  const persistedKey = persistedIds.join(",");
  useEffect(() => {
    setDraft(null);
  }, [persistedKey]);

  const orderedIds = useMemo(() => {
    if (!draft) {
      return persistedIds;
    }
    const known = new Set(persistedIds);
    const drafted = draft.filter((id) => known.has(id));
    const draftedSet = new Set(drafted);
    return [...drafted, ...persistedIds.filter((id) => !draftedSet.has(id))];
  }, [draft, persistedIds]);

  const isDirty = useMemo(
    () => orderedIds.length === persistedIds.length && orderedIds.some((id, index) => id !== persistedIds[index]),
    [orderedIds, persistedIds]
  );

  const moveItem = (id: number, direction: -1 | 1) => {
    const index = orderedIds.indexOf(id);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= orderedIds.length) {
      return;
    }
    const next = orderedIds.slice();
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    setDraft(next);
  };

  const saveOrder = async () => {
    if (!isDirty || saving) {
      return;
    }
    setSaving(true);
    try {
      await save(orderedIds);
      toast.success(successMessage);
      setDraft(null);
    } catch (error) {
      showErrorToast(error, errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return { orderedIds, moveItem, isDirty, saving, saveOrder };
}

export function sortByIdOrder<T extends { id: number }>(items: T[], orderedIds: number[]) {
  const indexById = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (indexById.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (indexById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
}
