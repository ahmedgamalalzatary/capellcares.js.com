import type { ReactNode } from "react";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { AdminShell } from "@/components/shell/admin-shell";

/** The shell-wrapped "you don't have permission" screen every guarded page was pasting inline. */
export function ForbiddenPage({
  title,
  crumbs,
  actions,
  message
}: {
  title: string;
  crumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  message: string;
}) {
  return (
    <AdminShell title={title} crumbs={crumbs} actions={actions}>
      <ErpForbiddenState message={message} />
    </AdminShell>
  );
}
