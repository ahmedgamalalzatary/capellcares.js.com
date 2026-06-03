"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { api } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";

type StaffUser = {
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

type StaffFormState = {
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  permissionKeys: string[];
};

function createEmptyForm(): StaffFormState {
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

export default function StaffManagementPage() {
  const { user, hydrated } = useAdminAuth();
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionItem[]>([]);
  const [permissionDependencies, setPermissionDependencies] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [form, setForm] = useState<StaffFormState>(createEmptyForm);
  const [saving, setSaving] = useState(false);

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

  async function loadStaffManagement() {
    setLoading(true);
    setError(null);
    try {
      const [permissionsResponse, staffResponse] = await Promise.all([
        api.get<{ items: PermissionItem[] }>("/api/erp/staff/permissions"),
        api.get<{ items: StaffUser[] }>("/api/erp/staff")
      ]);
      setPermissionCatalog(permissionsResponse.items);
      try {
        setPermissionDependencies(getPermissionDependencies(permissionsResponse.items));
      } catch {
        setPermissionDependencies({});
      }
      setStaffUsers(staffResponse.items);
    } catch (loadError) {
      setPermissionDependencies({});
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated || user?.role !== "admin") {
      return;
    }
    void loadStaffManagement();
  }, [hydrated, user?.role]);

  function startCreate() {
    setEditingStaffId(null);
    setForm(createEmptyForm());
    setError(null);
  }

  function startEdit(staffUser: StaffUser) {
    setEditingStaffId(staffUser.id);
    setForm({
      name: staffUser.name,
      email: staffUser.email,
      password: "",
      isActive: staffUser.isActive,
      permissionKeys: staffUser.permissionKeys
    });
    setError(null);
  }

  function togglePermission(key: string, checked: boolean) {
    setForm((current) => {
      const nextKeys = checked
        ? normalizePermissionKeys([...current.permissionKeys, key], permissionDependencies)
        : current.permissionKeys.filter((currentKey) => currentKey !== key);

      return {
        ...current,
        permissionKeys: nextKeys
      };
    });
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
      if (editingStaffId == null) {
        await api.post("/api/erp/staff", payload);
      } else {
        await api.put(`/api/erp/staff/${editingStaffId}`, payload);
      }
      startCreate();
      await loadStaffManagement();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated || !user) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <AdminShell title="فريق العمل" crumbs={[{ label: "فريق العمل" }]}>
        <section className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>غير مصرح</h2>
          <p style={{ marginBottom: 0 }}>إدارة فريق العمل متاحة للمسؤول الرئيسي فقط.</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="فريق العمل" crumbs={[{ label: "فريق العمل" }]}>
      <div style={{ display: "grid", gap: 20 }}>
        <section className="card" style={{ padding: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>{editingStaffId == null ? "إضافة عضو" : "تعديل عضو"}</h2>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                أنشئي حسابات الموظفين وحددي الصلاحيات المطلوبة لكل عضو.
              </p>
            </div>
            {editingStaffId != null ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={startCreate}>
                إلغاء التعديل
              </button>
            ) : null}
          </div>

          <form onSubmit={submitForm} style={{ display: "grid", gap: 16 }}>
            <div className="grid-2">
              <label style={{ display: "grid", gap: 6 }}>
                <span>الاسم</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>البريد الإلكتروني</span>
                <input
                  className="input"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
            </div>

            <div className="grid-2">
              <label style={{ display: "grid", gap: 6 }}>
                <span>{editingStaffId == null ? "كلمة المرور" : "كلمة المرور الجديدة"}</span>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={editingStaffId == null ? "" : "اتركيه فارغًا للإبقاء عليها كما هي"}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 28 }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span>الحساب نشط</span>
              </label>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <h3 style={{ margin: 0 }}>الصلاحيات</h3>
              {permissionGroups.map(([moduleName, items]) => (
                <div key={moduleName} className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{moduleName}</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {items.map((item) => (
                      <label key={item.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={form.permissionKeys.includes(item.key)}
                          onChange={(event) => togglePermission(item.key, event.target.checked)}
                          aria-label={`${moduleName} / ${item.key}`}
                        />
                        <span>{item.key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error ? <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p> : null}

            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
                {saving ? "جارٍ الحفظ..." : editingStaffId == null ? "إنشاء العضو" : "حفظ التعديلات"}
              </button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={startCreate} disabled={saving}>
                تفريغ النموذج
              </button>
            </div>
          </form>
        </section>

        <section className="card" style={{ padding: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>أعضاء الفريق</h2>
            <span className="muted">{staffUsers.length} عضو</span>
          </div>

          {loading ? <p className="muted">جارٍ تحميل أعضاء الفريق...</p> : null}

          {!loading && staffUsers.length === 0 ? <p className="muted">لا يوجد أعضاء فريق حتى الآن.</p> : null}

          {!loading && staffUsers.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الحالة</th>
                  <th>الصلاحيات</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((staffUser) => (
                  <tr key={staffUser.id}>
                    <td>{staffUser.name}</td>
                    <td>{staffUser.email}</td>
                    <td>{staffUser.isActive ? "نشط" : "غير نشط"}</td>
                    <td>{staffUser.permissionKeys.join(", ") || "بدون صلاحيات"}</td>
                    <td>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEdit(staffUser)}>
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
