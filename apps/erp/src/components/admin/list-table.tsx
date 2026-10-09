import { Fragment, type ReactNode } from "react";
import type { ListSort } from "@/components/admin/admin-list-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableState, TR } from "@/components/ui/table";
import type { SortState } from "@/hooks/use-table-sort";

/**
 * Faded placeholder rows shown while a list loads. `cells` is one row's `<TD>`s; the row shell
 * itself (the `<TR>` and its `aria-hidden`) is what every table was copying.
 */
export function TableSkeletonRows({ rows = 5, cells }: { rows?: number; cells: ReactNode[] }) {
  return Array.from({ length: rows }, (_, index) => (
    <TR key={index} aria-hidden>
      {cells.map((cell, cellIndex) => (
        <Fragment key={cellIndex}>{cell}</Fragment>
      ))}
    </TR>
  ));
}

/** The full-width "nothing here" row inside a table body. */
export function TableEmptyRow({
  colSpan,
  icon,
  title,
  description,
  action,
  tone
}: {
  colSpan: number;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <TableState colSpan={colSpan}>
      <EmptyState icon={icon} title={title} description={description} action={action} tone={tone} />
    </TableState>
  );
}

/** The phone-only sort control every list page passes to `AdminListHeader`'s `sort` prop. */
export function tableSortSelect<K extends string>(
  columns: ReadonlyArray<{ key: K; label: string }>,
  sort: SortState<K> | null,
  setSort: (sort: SortState<K> | null) => void
): ListSort {
  return {
    value: sort ? `${sort.key}:${sort.direction}` : "",
    onChange: (value) => {
      const [key, direction] = value.split(":");
      setSort(key ? { key: key as K, direction: direction as SortState<K>["direction"] } : null);
    },
    options: [
      { value: "", label: "ترتيب المتجر" },
      ...columns.flatMap((column) => [
        { value: `${column.key}:asc`, label: `${column.label} — تصاعدي` },
        { value: `${column.key}:desc`, label: `${column.label} — تنازلي` }
      ])
    ]
  };
}
