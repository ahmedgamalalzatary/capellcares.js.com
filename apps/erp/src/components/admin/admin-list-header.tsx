"use client";

import type { ReactNode } from "react";
import { DropdownMenu, Popover } from "radix-ui";
import { Check, ChevronLeft, Filter, RotateCcw, Search, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputWithIcon, Select } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export interface ListFilterOption {
  value: string;
  label: string;
}

export interface ListFilter {
  key: string;
  /** The filter's name in the menu and its accessible name. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ListFilterOption[];
  /** Shown beside the filter's name in the desktop menu. */
  icon?: LucideIcon;
  /** The "no filter" value; defaults to the first option. */
  defaultValue?: string;
  testId?: string;
}

/** Sorting for phones, where the sortable column headers are hidden. */
export interface ListSort {
  value: string;
  onChange: (value: string) => void;
  options: ListFilterOption[];
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
  /** Extra filter controls (e.g. date ranges) rendered inside the filter menu. */
  customFilters?: ReactNode;
  /** Desktop submenu label for the custom filters. */
  customFiltersLabel?: string;
  sort?: ListSort;
}

const TREE_PREFIX = /^(— )+/;
const defaultOf = (filter: ListFilter) => filter.defaultValue ?? filter.options[0]?.value ?? "";
const labelOf = (filter: ListFilter) =>
  filter.options.find((option) => option.value === filter.value)?.label.replace(TREE_PREFIX, "") ?? filter.value;

const PANEL =
  "z-50 rounded-well bg-surface shadow-float outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";
const MENU_ITEM =
  "flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-base text-text outline-none data-[highlighted]:bg-hover data-[highlighted]:text-text-strong data-[state=open]:bg-hover data-[state=open]:text-text-strong pointer-coarse:h-11";
const SUBMENU_SCROLL = "max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] min-w-56 overflow-y-auto";

/* ────────────────────────────── Desktop: cascading menu ────────────────────────────── */

/** One option; tree depth (the "— " prefixes category filters use) becomes indentation. */
function OptionItem({ value, label }: { value: string; label: string }) {
  const depth = (label.match(TREE_PREFIX)?.[0].length ?? 0) / 2;
  return (
    <DropdownMenu.RadioItem value={value} className={cn(MENU_ITEM, "data-[state=checked]:font-medium data-[state=checked]:text-text-strong")}>
      <span className="flex-1 truncate" style={depth ? { paddingInlineStart: `${depth * 14}px` } : undefined}>
        {label.replace(TREE_PREFIX, "")}
      </span>
      <DropdownMenu.ItemIndicator>
        <Check className="size-4 text-nude-strong" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

function CascadeSection({
  icon: SectionIcon,
  label,
  valueLabel,
  changed = false,
  freeform = false,
  testId,
  children,
}: {
  icon: LucideIcon;
  label: string;
  valueLabel?: string;
  changed?: boolean;
  freeform?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={MENU_ITEM} data-testid={testId}>
        <SectionIcon className="size-4 shrink-0 text-text-muted" />
        <span className="flex-1">{label}</span>
        {valueLabel ? (
          <span className={cn("max-w-28 truncate text-sm", changed ? "font-medium text-nude-strong" : "text-text-muted")}>{valueLabel}</span>
        ) : null}
        <ChevronLeft className="size-4 shrink-0 text-text-muted" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={6}
          alignOffset={-6}
          collisionPadding={12}
          className={cn(PANEL, "grid gap-0.5 p-1.5", freeform ? "min-w-64" : SUBMENU_SCROLL)}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function FilterCascade({
  trigger,
  filters,
  activeCount,
  resetAll,
  customFilters,
  customFiltersLabel,
}: {
  trigger: ReactNode;
  filters: ListFilter[];
  activeCount: number;
  resetAll: () => void;
  customFilters?: ReactNode;
  customFiltersLabel: string;
}) {
  return (
    <DropdownMenu.Root dir="rtl" modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={12} className={cn(PANEL, "grid min-w-60 gap-0.5 p-1.5")}>
          {filters.map((filter) => (
            <CascadeSection
              key={filter.key}
              icon={filter.icon ?? Filter}
              label={filter.label}
              valueLabel={labelOf(filter)}
              changed={filter.value !== defaultOf(filter)}
              testId={filter.testId}
            >
              <DropdownMenu.RadioGroup value={filter.value} onValueChange={filter.onChange} aria-label={filter.label}>
                {filter.options.map((option) => (
                  <OptionItem key={option.value} value={option.value} label={option.label} />
                ))}
              </DropdownMenu.RadioGroup>
            </CascadeSection>
          ))}

          {customFilters ? (
            <CascadeSection icon={Filter} label={customFiltersLabel} freeform>
              {/* Free-form controls: keep typing from triggering the menu's type-ahead. */}
              <div className="grid gap-3 p-1.5" onKeyDown={(event) => event.stopPropagation()}>{customFilters}</div>
            </CascadeSection>
          ) : null}

          {filters.length > 0 ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                disabled={activeCount === 0}
                onSelect={resetAll}
                className={cn(MENU_ITEM, "data-[disabled]:pointer-events-none data-[disabled]:text-icon-faint")}
              >
                <RotateCcw className="size-4 shrink-0" />
                <span>إعادة الضبط</span>
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ────────────────────────────── Phone: filter panel ────────────────────────────── */

function FilterPanel({
  trigger,
  filters,
  activeCount,
  resetAll,
  customFilters,
  sort,
}: {
  trigger: ReactNode;
  filters: ListFilter[];
  activeCount: number;
  resetAll: () => void;
  customFilters?: ReactNode;
  sort?: ListSort;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          dir="rtl"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(PANEL, "grid max-h-[var(--radix-popover-content-available-height)] w-[min(340px,calc(100vw-24px))] gap-4 overflow-y-auto p-4")}
        >
          <div className="flex items-center justify-between">
            <p className="text-md font-bold text-text-strong">تصفية النتائج</p>
            <Popover.Close aria-label="إغلاق" className="-me-1.5 grid size-9 place-items-center rounded-md text-text-muted hover:bg-hover hover:text-text-strong">
              <X className="size-4" />
            </Popover.Close>
          </div>

          {filters.map((filter) => (
            <label key={filter.key} className="grid gap-1.5">
              <span className="text-sm font-medium text-text-2">{filter.label}</span>
              <Select
                aria-label={filter.label}
                data-testid={filter.testId}
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
          ))}

          {customFilters ? <div className="grid gap-3">{customFilters}</div> : null}

          {sort ? (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-text-2">ترتيب حسب</span>
              <Select aria-label="ترتيب حسب" value={sort.value} onChange={(event) => sort.onChange(event.target.value)}>
                {sort.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
          ) : null}

          {filters.length > 0 ? (
            <div className="flex justify-end border-t border-line pt-3">
              <Button variant="ghost" size="sm" disabled={activeCount === 0} onClick={resetAll}>
                <RotateCcw /> إعادة الضبط
              </Button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ────────────────────────────── Header ────────────────────────────── */

/**
 * Shared header for every ERP list page: one search box and one "تصفية" control.
 * Desktop: a cascading menu, each filter a submenu showing its current value.
 * Phones: a panel of labelled selects, plus sorting (the sortable column headers are hidden there).
 * Active filters echo below as removable chips so the current view is always readable.
 */
export function AdminListHeader({
  searchPlaceholder,
  searchLabel,
  searchValue,
  onSearchChange,
  countLabel,
  filters = [],
  customFilters,
  customFiltersLabel = "فلاتر إضافية",
  sort
}: AdminListHeaderProps) {
  const phone = useMediaQuery("(max-width: 767px)");
  const active = filters.filter((filter) => filter.value !== defaultOf(filter));
  const resetAll = () => active.forEach((filter) => filter.onChange(defaultOf(filter)));
  const hasFilters = filters.length > 0 || Boolean(customFilters);
  const showControl = hasFilters || (phone && Boolean(sort));

  const trigger = (
    <Button variant="secondary" className="data-[state=open]:bg-hover">
      <SlidersHorizontal />
      <span className="max-sm:sr-only">تصفية</span>
      {active.length > 0 ? (
        <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-sand-900 px-1.5 text-xs text-sand-50">
          {active.length}
        </span>
      ) : null}
    </Button>
  );

  return (
    <div className="mb-4 grid gap-3">
      <div className="flex items-center gap-2.5">
        <InputWithIcon
          icon={<Search />}
          type="search"
          className="min-w-0 flex-1 md:max-w-md"
          aria-label={searchLabel ?? searchPlaceholder}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        {showControl ? (
          phone ? (
            <FilterPanel trigger={trigger} filters={filters} activeCount={active.length} resetAll={resetAll} customFilters={customFilters} sort={sort} />
          ) : (
            <FilterCascade
              trigger={trigger}
              filters={filters}
              activeCount={active.length}
              resetAll={resetAll}
              customFilters={customFilters}
              customFiltersLabel={customFiltersLabel}
            />
          )
        ) : null}

        <p className="ms-auto shrink-0 whitespace-nowrap text-sm text-text-muted" aria-live="polite">{countLabel}</p>
      </div>

      {active.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((filter) => (
            <span key={filter.key} className="inline-flex h-8 items-center gap-1 rounded-full bg-nude-soft ps-3 pe-1 text-sm text-text-strong">
              <span className="text-text-muted">{filter.label}:</span>
              <span className="font-medium">{labelOf(filter)}</span>
              <button
                type="button"
                aria-label={`إزالة فلتر ${filter.label}`}
                onClick={() => filter.onChange(defaultOf(filter))}
                className="grid size-6 place-items-center rounded-full text-text-muted hover:bg-surface hover:text-text-strong pointer-coarse:size-8"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {active.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={resetAll}>مسح الكل</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
