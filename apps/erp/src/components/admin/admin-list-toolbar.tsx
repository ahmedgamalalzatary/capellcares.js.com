"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icons";

interface AdminListToolbarProps {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  countLabel: string;
  extraControls?: ReactNode;
  stacked?: boolean;
}

export function AdminListToolbar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  countLabel,
  extraControls,
  stacked = false
}: AdminListToolbarProps) {
  return (
    <div className={stacked ? "toolbar toolbar--stacked" : "toolbar"}>
      <div className={stacked ? "toolbar__search" : undefined}>
        <div className="search">
          <Icon.Search />
          <input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
      <div className={stacked ? "muted toolbar__count" : "muted"} style={stacked ? undefined : { marginInlineStart: "auto" }}>
        {countLabel}
      </div>
      {extraControls}
    </div>
  );
}
