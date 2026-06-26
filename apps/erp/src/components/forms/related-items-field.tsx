"use client";

import type { Bilingual, RelatedItemRef, RelatedItemType } from "@minikoshk/shared";
import { Icon } from "@/components/ui/icons";

export interface RelatedOption {
  type: RelatedItemType;
  id: number;
  name: Bilingual;
  slug?: string;
}

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

export function RelatedItemsField({ value, options, onChange, disabled = false }: Props) {
  const optionByKey = new Map(options.map((option) => [refKey(option), option]));
  const selectedKeys = new Set(value.map(refKey));
  const available = options.filter((option) => !selectedKeys.has(refKey(option)));

  const add = (key: string) => {
    const option = optionByKey.get(key);
    if (disabled || !option || selectedKeys.has(key)) return;
    onChange([...value, { type: option.type, id: option.id }]);
  };

  const remove = (index: number) => {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (disabled || target < 0 || target >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  };

  const labelFor = (ref: RelatedItemRef): string => {
    const option = optionByKey.get(refKey(ref));
    const name = option ? option.name.ar || option.name.en : `#${ref.id}`;
    return `${TYPE_LABEL[ref.type]} · ${name}`;
  };

  return (
    <div className="field" data-testid="related-items-field">
      <label htmlFor="related-items-add">العناصر المرتبطة</label>
      <select
        className="input"
        id="related-items-add"
        data-testid="related-items-add"
        value=""
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value) add(event.target.value);
        }}
      >
        <option value="">أضيفي عنصرًا مرتبطًا…</option>
        {available.map((option) => (
          <option key={refKey(option)} value={refKey(option)}>
            {TYPE_LABEL[option.type]} · {option.name.ar || option.name.en}
          </option>
        ))}
      </select>

      {value.length > 0 && (
        <ul className="related-items-list">
          {value.map((ref, index) => (
            <li className="related-item-row" data-testid="related-item-row" key={refKey(ref)}>
              <span className="related-item-row__label">{labelFor(ref)}</span>
              <div className="related-item-row__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-label="تحريك لأعلى"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-label="تحريك لأسفل"
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-label="إزالة"
                  disabled={disabled}
                  onClick={() => remove(index)}
                >
                  <Icon.Trash />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
