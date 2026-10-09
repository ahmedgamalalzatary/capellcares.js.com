import { Badge } from "@/components/ui/badge";
import type { ListFilterOption } from "@/components/admin/admin-list-header";

/** The active/inactive filter shared by every toggleable ERP entity. */
export const ACTIVE_STATUS_FILTER_OPTIONS: ListFilterOption[] = [
  { value: "all", label: "كل الحالات" },
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" }
];

/** Active/inactive status pill used across the ERP lists. */
export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "نشط" : "غير نشط"}</Badge>;
}
