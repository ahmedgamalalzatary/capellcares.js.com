"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "لوحة التحكم",
  products: "المنتجات",
  categories: "التصنيفات",
  offers: "العروض",
  collections: "المجموعات",
  advices: "النصائح",
  orders: "الطلبات",
  reviews: "التقييمات",
  sales: "المبيعات",
  trash: "المهملات"
};

const ACTION_LABELS: Record<string, string> = {
  read: "عرض",
  create: "إضافة",
  update: "تعديل",
  discount: "إدارة الخصم",
  soft_delete: "حذف",
  delete: "حذف",
  permanent_delete: "حذف نهائي",
  restore: "استرجاع",
  toggle_status: "تغيير الحالة",
  stock_update: "تحديث المخزون",
  update_payment_status: "تحديث حالة الدفع"
};

function moduleLabel(moduleName: string) {
  return MODULE_LABELS[moduleName] ?? moduleName;
}

function actionLabel(key: string) {
  const action = key.split(".").slice(1).join(".");
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: "staff";
  isActive: boolean;
  permissionKeys: string[];
};

type PermissionItem = {
  key: string;
  dependencies?: string[];
};

export type StaffFormState = {
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  permissionKeys: string[];
};

export function createEmptyStaffForm(): StaffFormState {
  return {
    name: "",
    email: "",
    password: "",
    isActive: true,
    permissionKeys: []
  };
}

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

  // Re-sync only when the target record/mode changes, not on every parent
  // re-render (initialValues is a fresh object each render at the call sites).
  useEffect(() => {
    setForm(initialValues);
  }, [staffId, mode]);

  useEffect(() => {
    let active = true;
    setLoadingPermissions(true);
    setError(null);

    api.get<{ items: PermissionItem[] }>("/api/erp/staff/permissions")
      .then((response) => {
        if (!active) {
          return;
        }

        setPermissionCatalog(response.items);

        try {
          setPermissionDependencies(getPermissionDependencies(response.items));
        } catch {
          setPermissionDependencies({});
        }
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setPermissionCatalog([]);
        setPermissionDependencies({});
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) {
          setLoadingPermissions(false);
        }
      });

    return () => {
      active = false;
    };
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

      if (onSuccess) {
        await onSuccess();
      }

      if (mode === "create") {
        setForm(createEmptyStaffForm());
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitForm} className="staff-form">
      <div className="staff-fields">
        <label className="field">
          <span>الاسم</span>
          <input
            className="input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>البريد الإلكتروني</span>
          <input
            className="input"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>{mode === "create" ? "كلمة المرور" : "كلمة المرور الجديدة"}</span>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={mode === "create" ? "" : "اتركيه فارغًا للإبقاء عليها كما هي"}
          />
        </label>
      </div>

      <label className="switch">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
        />
        <span className="switch__track" aria-hidden="true" />
        <span className="switch__text">
          <span className="switch__title">الحساب نشط</span>
          <span className="switch__hint">
            {form.isActive ? "يمكن للعضو تسجيل الدخول واستخدام صلاحياته." : "العضو موقوف ولا يمكنه تسجيل الدخول."}
          </span>
        </span>
      </label>

      <div className="stack">
        <div className="row row--between row--baseline">
          <h3 className="staff-form__heading">الصلاحيات</h3>
          <span className="muted fs-12">{form.permissionKeys.length} مفعّلة</span>
        </div>

        {loadingPermissions ? <p className="muted">جارٍ تحميل الصلاحيات...</p> : null}

        {!loadingPermissions && permissionGroups.map(([moduleName, items]) => {
          const selectedCount = items.filter((item) => form.permissionKeys.includes(item.key)).length;
          const allSelected = selectedCount === items.length && items.length > 0;

          return (
            <div key={moduleName} className="perm-group">
              <div className="perm-group__head">
                <span className="perm-group__title">{moduleLabel(moduleName)}</span>
                <span className="perm-group__count" data-full={allSelected || undefined}>
                  {selectedCount}/{items.length}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm perm-group__all"
                  onClick={() => togglePermissionGroup(items, !allSelected)}
                >
                  {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                </button>
              </div>
              <div className="perm-grid">
                {items.map((item) => {
                  const checked = form.permissionKeys.includes(item.key);

                  return (
                    <label key={item.key} className="perm-chip" data-checked={checked || undefined}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => togglePermission(item.key, event.target.checked)}
                        aria-label={`${moduleLabel(moduleName)} / ${actionLabel(item.key)}`}
                      />
                      <span className="perm-chip__box" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l4 4 10-10" />
                        </svg>
                      </span>
                      <span className="perm-chip__text">
                        <span className="perm-chip__label">{actionLabel(item.key)}</span>
                        <span className="perm-chip__key">{item.key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="form-error-note">{error}</p> : null}

      <div className="row row--gap-lg">
        <button className="btn btn--primary btn--sm" type="submit" disabled={saving || loadingPermissions}>
          {saving ? "جارٍ الحفظ..." : submitLabel ?? (mode === "create" ? "إنشاء العضو" : "حفظ التعديلات")}
        </button>
        <button className="btn btn--ghost btn--sm" type="button" onClick={resetForm} disabled={saving}>
          {resetLabel}
        </button>
      </div>
    </form>
  );
}
