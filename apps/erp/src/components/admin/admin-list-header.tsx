"use client";

import { Icon } from "@/components/ui/icons";

export interface ListFilterOption {
  value: string;
  label: string;
}

export interface ListFilter {
  key: string;
  /** Rendered as the select's accessible name — every list filter must have one. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ListFilterOption[];
  testId?: string;
}

/** The active/inactive filter shared by every toggleable ERP entity. */
export const ACTIVE_STATUS_FILTER_OPTIONS: ListFilterOption[] = [
  { value: "all", label: "كل الحالات" },
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" }
];

interface AdminListHeaderProps {
  searchPlaceholder: string;
  /** Accessible name for the search box; defaults to the placeholder. */
  searchLabel?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  countLabel: string;
  filters?: ListFilter[];
}

/**
 * Shared header for every ERP list page: search, the page's own filters, and a count.
 * Filters are declared as data so search styling, select styling, and accessible names
 * stay identical across pages no matter how many filters a page needs.
 */
export function AdminListHeader({
  searchPlaceholder,
  searchLabel,
  searchValue,
  onSearchChange,
  countLabel,
  filters = []
}: AdminListHeaderProps) {
  return (
    <div className="toolbar list-header">
      <div className="list-header__search">
        <div className="search">
          <Icon.Search />
          <input
            aria-label={searchLabel ?? searchPlaceholder}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      {filters.length > 0 ? (
        <div className="list-header__filters">
          {filters.map((filter) => (
            <select
              key={filter.key}
              className="select"
              aria-label={filter.label}
              data-testid={filter.testId}
              value={filter.value}
              onChange={(event) => filter.onChange(event.target.value)}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ))}
        </div>
      ) : null}

      <div className="muted list-header__count">{countLabel}</div>
    </div>
  );
}
