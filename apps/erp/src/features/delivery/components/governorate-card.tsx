"use client";

import { Plus, Trash2 } from "lucide-react";
import { FoldButton } from "@/components/admin/fold-button";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, InputWithAddon } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { moveItem } from "@/lib/array";
import { newArea, type DraftArea, type DraftGovernorate } from "@/features/delivery/lib/delivery-draft";

type Props = {
  governorate: DraftGovernorate;
  index: number;
  count: number;
  canEdit: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onChange: (next: DraftGovernorate) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: () => void;
};

/** One governorate: its names and on/off switch, then its areas with their delivery fees. */
export function GovernorateCard({ governorate, index, count, canEdit, collapsed, onToggleCollapsed, onChange, onMove, onRemove }: Props) {
  const title = governorate.arName.trim() || "محافظة جديدة";
  const activeAreas = governorate.areas.filter((area) => area.status === "active").length;
  const setArea = (key: string, patch: Partial<DraftArea>) =>
    onChange({ ...governorate, areas: governorate.areas.map((area) => (area.key === key ? { ...area, ...patch } : area)) });
  const idFor = (name: string, key = governorate.key) => `delivery-${name}-${key}`;

  return (
    <section aria-label={title}>
      <Card>
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <FoldButton collapsed={collapsed} onClick={onToggleCollapsed} label={collapsed ? "توسيع المحافظة" : "طي المحافظة"} />
            <h2 className="truncate text-md font-bold">{title}</h2>
            <Badge tone="neutral" swatch={false}>
              <span className="num">{activeAreas}</span>&nbsp;من&nbsp;<span className="num">{governorate.areas.length}</span>&nbsp;منطقة نشطة
            </Badge>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-text-2">
                <Switch
                  checked={governorate.status === "active"}
                  onCheckedChange={(checked) => onChange({ ...governorate, status: checked ? "active" : "inactive" })}
                  aria-label={`تفعيل ${title}`}
                />
                {governorate.status === "active" ? "نشطة" : "غير نشطة"}
              </label>
              <ReorderButtons index={index} count={count} className="gap-2" onMove={onMove} />
              <Button variant="danger-ghost" size="icon-sm" aria-label={`حذف ${title}`} onClick={onRemove}>
                <Trash2 />
              </Button>
            </div>
          ) : (
            <Badge tone={governorate.status === "active" ? "success" : "neutral"}>{governorate.status === "active" ? "نشطة" : "غير نشطة"}</Badge>
          )}
        </header>

        {collapsed ? null : (
          <CardBody className="@container grid gap-4">
            <div className="grid gap-x-4 gap-y-5 @lg:grid-cols-2">
              <Field label="اسم المحافظة بالعربية" htmlFor={idFor("ar")}>
                <Input id={idFor("ar")} value={governorate.arName} disabled={!canEdit} onChange={(event) => onChange({ ...governorate, arName: event.target.value })} />
              </Field>
              <Field label="اسم المحافظة بالإنجليزية" htmlFor={idFor("en")}>
                <Input id={idFor("en")} dir="ltr" value={governorate.enName} disabled={!canEdit} onChange={(event) => onChange({ ...governorate, enName: event.target.value })} />
              </Field>
            </div>

            {governorate.areas.length === 0 ? (
              <div className="rounded-well border border-dashed border-line-strong bg-sunken px-6 py-6 text-center text-sm text-text-muted">
                لا توجد مناطق بعد. لن تظهر هذه المحافظة في صفحة الدفع حتى تضيفي منطقة نشطة.
              </div>
            ) : (
              <ol className="grid gap-3">
                {governorate.areas.map((area, areaIndex) => (
                  <li key={area.key} className="grid gap-3 rounded-well bg-sunken p-3 @3xl:grid-cols-[1fr_1fr_11rem_auto] @3xl:items-end">
                    <Field label="اسم المنطقة بالعربية" htmlFor={idFor("area-ar", area.key)}>
                      <Input id={idFor("area-ar", area.key)} value={area.arName} disabled={!canEdit} onChange={(event) => setArea(area.key, { arName: event.target.value })} />
                    </Field>
                    <Field label="اسم المنطقة بالإنجليزية" htmlFor={idFor("area-en", area.key)}>
                      <Input id={idFor("area-en", area.key)} dir="ltr" value={area.enName} disabled={!canEdit} onChange={(event) => setArea(area.key, { enName: event.target.value })} />
                    </Field>
                    <Field label="رسوم التوصيل" htmlFor={idFor("area-fee", area.key)}>
                      <InputWithAddon
                        id={idFor("area-fee", area.key)}
                        addon="د.ك"
                        inputMode="decimal"
                        className="num"
                        value={area.fee}
                        disabled={!canEdit}
                        onChange={(event) => setArea(area.key, { fee: event.target.value })}
                      />
                    </Field>
                    {canEdit ? (
                      <div className="flex h-10 items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-text-2">
                          <Switch
                            checked={area.status === "active"}
                            onCheckedChange={(checked) => setArea(area.key, { status: checked ? "active" : "inactive" })}
                            aria-label={`تفعيل ${area.arName.trim() || "المنطقة"}`}
                          />
                          {area.status === "active" ? "نشطة" : "غير نشطة"}
                        </label>
                        <ReorderButtons
                          index={areaIndex}
                          count={governorate.areas.length}
                          className="gap-2"
                          onMove={(i, delta) => onChange({ ...governorate, areas: moveItem(governorate.areas, i, delta) })}
                        />
                        <Button
                          variant="danger-ghost"
                          size="icon-sm"
                          aria-label={`حذف ${area.arName.trim() || "المنطقة"}`}
                          onClick={() => onChange({ ...governorate, areas: governorate.areas.filter((entry) => entry.key !== area.key) })}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ) : (
                      <Badge tone={area.status === "active" ? "success" : "neutral"}>{area.status === "active" ? "نشطة" : "غير نشطة"}</Badge>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {canEdit ? (
              <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => onChange({ ...governorate, areas: [...governorate.areas, newArea()] })}>
                <Plus /> إضافة منطقة
              </Button>
            ) : null}
          </CardBody>
        )}
      </Card>
    </section>
  );
}
