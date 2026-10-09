"use client";

import { useMemo, useState } from "react";
import { Popover } from "radix-ui";
import { Plus, Search, X } from "lucide-react";
import type { RelatedItemRef, RelatedItemType } from "@capella/shared";
import { Badge } from "@/components/ui/badge";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { Button } from "@/components/ui/button";
import { InputWithIcon } from "@/components/ui/input";
import type { RelatedOption } from "@/lib/related-options";
import { moveItem } from "@/lib/array";

interface Props {
  value: RelatedItemRef[];
  options: RelatedOption[];
  onChange: (next: RelatedItemRef[]) => void;
  disabled?: boolean;
}

function refKey(ref: { type: RelatedItemType; id: number }): string {
  return `${ref.type}:${ref.id}`;
}

const TYPE_LABEL: Record<RelatedItemType, string> = {
  product: "منتج",
  offer: "عرض",
  collection: "مجموعة"
};

const GROUPS: { type: RelatedItemType; label: string }[] = [
  { type: "product", label: "منتجات" },
  { type: "offer", label: "عروض" },
  { type: "collection", label: "مجموعات" }
];

const nameOf = (option: RelatedOption) => option.name.ar || option.name.en;

/** Searchable picker in a fixed-width panel; stays open so several items can be added in a row. */
function AddRelatedItem({ available, onAdd, disabled }: { available: RelatedOption[]; onAdd: (option: RelatedOption) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? available.filter((option) => option.name.ar.toLowerCase().includes(needle) || option.name.en.toLowerCase().includes(needle))
      : available;
    return GROUPS.map((group) => ({ ...group, items: matches.filter((option) => option.type === group.type) })).filter((group) => group.items.length > 0);
  }, [available, query]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Popover.Trigger asChild>
        <Button size="sm" disabled={disabled} data-testid="related-items-add" className="justify-self-start">
          <Plus /> إضافة عنصر
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 grid w-[min(360px,calc(100vw-24px))] gap-2 rounded-well bg-surface p-2 shadow-float outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <InputWithIcon
            icon={<Search />}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحثي بالاسم…"
            aria-label="البحث في العناصر"
          />
          <div className="max-h-72 overflow-y-auto" role="listbox" aria-label="العناصر المتاحة">
            {groups.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-text-muted">{available.length === 0 ? "أُضيفت كل العناصر المتاحة." : "لا توجد نتائج مطابقة."}</p>
            ) : (
              groups.map((group) => (
                <div key={group.type} role="group" aria-label={group.label} className="grid gap-0.5 py-1">
                  <p className="px-2.5 pb-1 text-xs font-medium text-text-muted">{group.label}</p>
                  {group.items.map((option) => (
                    <button
                      key={refKey(option)}
                      type="button"
                      role="option"
                      aria-selected={false}
                      data-testid="related-items-option"
                      onClick={() => onAdd(option)}
                      className="flex h-9 items-center gap-2 rounded-md px-2.5 text-start text-base text-text outline-none transition-colors hover:bg-hover hover:text-text-strong focus-visible:bg-hover focus-visible:text-text-strong pointer-coarse:h-11"
                    >
                      <span className="min-w-0 flex-1 truncate">{nameOf(option)}</span>
                      <Plus aria-hidden className="size-4 shrink-0 text-text-muted" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function RelatedItemsField({ value, options, onChange, disabled = false }: Props) {
  const optionByKey = new Map(options.map((option) => [refKey(option), option]));
  const selectedKeys = new Set(value.map(refKey));
  const available = options.filter((option) => !selectedKeys.has(refKey(option)));

  const add = (option: RelatedOption) => {
    if (disabled || selectedKeys.has(refKey(option))) return;
    onChange([...value, { type: option.type, id: option.id }]);
  };

  const remove = (index: number) => {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: -1 | 1) => {
    if (disabled) return;
    onChange(moveItem(value, index, delta));
  };

  const nameFor = (ref: RelatedItemRef): string => {
    const option = optionByKey.get(refKey(ref));
    return option ? nameOf(option) : `#${ref.id}`;
  };

  return (
    <div className="@container grid gap-3" data-testid="related-items-field">
      <AddRelatedItem available={available} onAdd={add} disabled={disabled} />

      {value.length > 0 ? (
        <ol className="grid gap-2">
          {value.map((ref, index) => (
            <li
              key={refKey(ref)}
              data-testid="related-item-row"
              className="flex min-h-11 items-center gap-2 rounded-control bg-sunken py-1 ps-3 pe-1"
            >
              <Badge swatch={false}>{TYPE_LABEL[ref.type]}</Badge>
              <span className="min-w-0 flex-1 truncate text-base text-text-strong">{nameFor(ref)}</span>
              <ReorderButtons index={index} count={value.length} onMove={move} disabled={disabled} className="gap-2" />
              <Button variant="danger-ghost" size="icon-sm" aria-label="إزالة" disabled={disabled} onClick={() => remove(index)}>
                <X />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-text-muted">لا توجد عناصر مرتبطة بعد.</p>
      )}
    </div>
  );
}
