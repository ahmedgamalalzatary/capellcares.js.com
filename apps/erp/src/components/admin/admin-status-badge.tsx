import type { ReactNode } from "react";

interface AdminStatusBadgeProps {
  active: boolean;
  activeLabel: ReactNode;
  inactiveLabel: ReactNode;
}

export function AdminStatusBadge({ active, activeLabel, inactiveLabel }: AdminStatusBadgeProps) {
  return active
    ? <span className="status status--active">{activeLabel}</span>
    : <span className="status status--inactive">{inactiveLabel}</span>;
}
