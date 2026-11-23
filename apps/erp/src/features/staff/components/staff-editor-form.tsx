"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { createEmptyStaffForm } from "@/features/staff/lib/staff-form-state";
import type { StaffFormState } from "@/features/staff/types";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "لوحة التحكم",
  products: "المنتجات",
  discounts: "الخصومات",
  promos: "أكواد الخصم",
  categories: "التصنيفات",
  offers: "العروض",
  collections: "المجموعات",
  advices: "النصائح",
  orders: "الطلبات",
  shipping: "الشحن",
  reviews: "التقييمات",
  sales: "المبيعات",
  trash: "المهملات"
};

const ACTION_LABELS: Record<string, string> = {
  read: "عرض",
  create: "إضافة",
  update: "تعديل",
  discount: "إدارة الخصم",
  manage: "إدارة الخصومات",
  soft_delete: "حذف",
  delete: "حذف",
  permanent_delete: "حذف نهائي",
  restore: "استرجاع",
  toggle_status: "تغيير الحالة",
  stock_update: "تحديث المخزون",
  update_payment_status: "تحديث حالة الدفع",
  update_state: "تحديث حالة الشحن",
  update_status: "إيقاف واستئناف"
};

function moduleLabel(moduleName: string) {
  return MODULE_LABELS[moduleName] ?? moduleName;
}

function actionLabel(key: string) {
  const action = key.split(".").slice(1).join(".");
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

type PermissionItem = {
  key: string;
  dependencies?: string[];
};

function normalizePermissionKeys(keys: string[], dependencies: Record<string, string[]>) {
  const resolved = new Set<string>();

  function addKey(key: string) {
    if (resolved.has(key)) {
      return;
    }
    resolved.add(key);
    for (const dependency of dependencies[key] ?? []) {
      addKey(dependency);
    }
  }

  for (const key of keys) {
    addKey(key);
  }

  return [...resolved].sort();
}

function getPermissionDependencies(items: PermissionItem[]) {
  const dependencies: Record<string, string[]> = {};

  for (const item of items) {
    if (!Array.isArray(item.dependencies) || item.dependencies.some((dependency) => typeof dependency !== "string")) {
      throw new Error(`Invalid dependencies for permission ${item.key}`);
    }
    dependencies[item.key] = [...item.dependencies];
  }

  return dependencies;
}

type Props = {
  mode: "create" | "edit";
  staffId?: number;
  initialValues: StaffFormState;
  onSuccess?: () => Promise<void> | void;
  submitLabel?: string;
  resetLabel?: string;
};

export function StaffEditorForm({
  mode,
  staffId,
  initialValues,
  onSuccess,
  submitLabel,
  resetLabel = "تفريغ النموذج"
}: Props) {
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionItem[]>([]);
  const [permissionDependencies, setPermissionDependencies] = useState<Record<string, string[]>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [form, setForm] = useState<StaffFormState>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTypedPassword, setShowTypedPassword] = useState(false);
  // undefined: not fetched yet; null: no password is kept for this member.
  const [currentPassword, setCurrentPassword] = useState<string | null | undefined>(undefined);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [loadingCurrentPassword, setLoadingCurrentPassword] = useState(false);

  // Re-sync only when the target record/mode changes, not on every parent re-render (initialValues is a fresh object each render at the call sites).
  useEffect(() => {
    setForm(initialValues);
    setCurrentPassword(undefined);
    setShowCurrentPassword(false);
  }, [staffId, mode]);

  /** The member's password is asked for only when the admin presses the eye, never on page load. */
  async function toggleCurrentPassword() {
    if (showCurrentPassword) {
      setShowCurrentPassword(false);
      return;
    }
    if (currentPassword === undefined) {
      setLoadingCurrentPassword(true);
      try {
        const response = await api.get<{ password: string | null }>(`/api/erp/staff/${staffId}/password`);
        setCurrentPassword(response.password);
      } catch {
        return;
      } finally {
        setLoadingCurrentPassword(false);
      }
    }
    setShowCurrentPassword(true);
  }

  useEffect(() => {
    let active = true;
    setLoadingPermissions(true);
    setError(null);

    api.get<{ items: PermissionItem[] }>("/api/erp/staff/permissions")
      .then((response) => {
        if (!active) return;
        setPermissionCatalog(response.items);
        try {
          setPermissionDependencies(getPermissionDependencies(response.items));
        } catch {
          setPermissionDependencies({});
        }
      })
      .catch((loadError) => {
        if (!active) return;
        setPermissionCatalog([]);
        setPermissionDependencies({});
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoadingPermissions(false);
      });

    return () => { active = false; };
  }, []);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>();
    for (const item of permissionCatalog) {
      const moduleName = item.key.split(".")[0] ?? "general";
      const current = groups.get(moduleName) ?? [];
      current.push(item);
      groups.set(moduleName, current);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [permissionCatalog]);

  function resetForm() {
    setForm(initialValues);
    setError(null);
  }

  function togglePermission(key: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      permissionKeys: checked
        ? normalizePermissionKeys([...current.permissionKeys, key], permissionDependencies)
        : current.permissionKeys.filter((currentKey) => currentKey !== key)
    }));
  }

  function togglePermissionGroup(items: PermissionItem[], checked: boolean) {
    const groupKeys = items.map((item) => item.key);
    setForm((current) => ({
      ...current,
      permissionKeys: checked
        ? normalizePermissionKeys([...current.permissionKeys, ...groupKeys], permissionDependencies)
        : current.permissionKeys.filter((currentKey) => !groupKeys.includes(currentKey))
    }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      isActive: form.isActive,
      permissionKeys: normalizePermissionKeys(form.permissionKeys, permissionDependencies)
    };

    try {
      if (mode === "create") {
        await api.post("/api/erp/staff", payload);
      } else {
        await api.put(`/api/erp/staff/${staffId}`, payload);
      }
      // A new password replaces the kept one, so the next look fetches it again.
      if (payload.password.trim().length > 0) {
        setCurrentPassword(undefined);
        setShowCurrentPassword(false);
      }
      if (onSuccess) await onSuccess();
      if (mode === "create") setForm(createEmptyStaffForm());
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitForm} className="grid gap-6">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="الاسم" htmlFor="staff-name">
          <Input id="staff-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="staff-email">
          <Input id="staff-email" dir="ltr" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </Field>
        <Field label={mode === "create" ? "كلمة المرور" : "كلمة المرور الجديدة"} htmlFor="staff-password">
          <span className="relative flex min-w-0">
            <Input
              id="staff-password"
              type={showTypedPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              className="pe-11"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={mode === "create" ? undefined : "اتركيه فارغًا للإبقاء عليها كما هي"}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute end-1 top-1/2 -translate-y-1/2"
              aria-label={showTypedPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={showTypedPassword}
              onClick={() => setShowTypedPassword((shown) => !shown)}
            >
              {showTypedPassword ? <EyeOff /> : <Eye />}
            </Button>
          </span>
        </Field>
      </div>

      {mode === "edit" && staffId != null ? (
        <div className="flex items-center gap-3 rounded-well bg-sunken p-4">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-base font-medium text-text-strong">كلمة المرور الحالية</span>
            {showCurrentPassword && currentPassword != null ? (
              <span dir="ltr" className="num select-all break-all text-start text-base text-text-strong">{currentPassword}</span>
            ) : showCurrentPassword ? (
              <span className="text-xs text-text-muted">كلمة المرور غير محفوظة. عيّني كلمة مرور جديدة لتظهر هنا.</span>
            ) : (
              <span aria-hidden className="text-base tracking-widest text-text-muted">••••••••</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={showCurrentPassword ? "إخفاء كلمة المرور الحالية" : "إظهار كلمة المرور الحالية"}
            aria-pressed={showCurrentPassword}
            disabled={loadingCurrentPassword}
            onClick={() => void toggleCurrentPassword()}
          >
            {showCurrentPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-well bg-sunken p-4">
        <Switch
          id="staff-active"
          checked={form.isActive}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
          className="mt-0.5"
        />
        <label htmlFor="staff-active" className="grid cursor-pointer gap-0.5">
          <span className="text-base font-medium text-text-strong">الحساب نشط</span>
          <span className="text-xs text-text-muted">
            {form.isActive ? "يمكن للعضو تسجيل الدخول واستخدام صلاحياته." : "العضو موقوف ولا يمكنه تسجيل الدخول."}
          </span>
        </label>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-md font-bold text-text-strong">الصلاحيات</h3>
          <span className="text-sm text-text-muted"><span className="num">{form.permissionKeys.length}</span> مفعّلة</span>
        </div>

        {loadingPermissions ? <p className="text-sm text-text-muted">جارٍ تحميل الصلاحيات…</p> : null}

        {!loadingPermissions && permissionGroups.map(([moduleName, items]) => {
          const selectedCount = items.filter((item) => form.permissionKeys.includes(item.key)).length;
          const allSelected = selectedCount === items.length && items.length > 0;

          return (
            <section key={moduleName} className="grid gap-3 rounded-well bg-sunken p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="text-base font-medium text-text-strong">{moduleLabel(moduleName)}</span>
                  <Badge tone={allSelected ? "success" : "neutral"} swatch={false}>
                    <span className="num">{selectedCount}/{items.length}</span>
                  </Badge>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => togglePermissionGroup(items, !allSelected)}>
                  {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const checked = form.permissionKeys.includes(item.key);
                  return (
                    <label
                      key={item.key}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-control bg-surface px-3 py-2 transition-shadow",
                        "hover:shadow-[0_0_0_1px_var(--line-strong)]",
                        checked && "bg-sunken shadow-[0_0_0_2px_var(--sand-900)]",
                        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0"
                        checked={checked}
                        onChange={(event) => togglePermission(item.key, event.target.checked)}
                        aria-label={`${moduleLabel(moduleName)} / ${actionLabel(item.key)}`}
                      />
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-base text-text-strong">{actionLabel(item.key)}</span>
                        <span dir="ltr" className="truncate text-xs text-text-muted">{item.key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={saving || loadingPermissions}>
          {saving ? "جارٍ الحفظ…" : submitLabel ?? (mode === "create" ? "إنشاء العضو" : "حفظ التعديلات")}
        </Button>
        <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
          {resetLabel}
        </Button>
      </div>
    </form>
  );
}
