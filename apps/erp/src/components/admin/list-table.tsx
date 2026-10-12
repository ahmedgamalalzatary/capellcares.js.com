import { Fragment, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { TableState, TR } from "@/components/ui/table";

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
