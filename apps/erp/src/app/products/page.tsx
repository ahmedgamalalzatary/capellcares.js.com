"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore, getStore } from "@/lib/store";
import { formatPrice, formatPriceRange, type Product } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { showErrorToast } from "@/lib/errors";

export default function ProductsListPage() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Product | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const rootCats = useMemo(() => categories.filter((c) => c.parentId === null && !c.deletedAt), [categories]);

  const filtered = useMemo(() => {
    return products
      .filter((p) => !p.deletedAt)
      .filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (categoryFilter !== "") {
          const cat = categories.find((c) => c.id === p.categoryId);
          if (!cat) return false;
          // match if product's category or any ancestor is the chosen root
          let cur: typeof cat | undefined = cat;
          while (cur) {
            if (cur.id === categoryFilter) break;
            cur = cur.parentId != null ? categories.find((x) => x.id === cur!.parentId) : undefined;
          }
          if (!cur) return false;
        }
        if (search.trim()) {
          const s = search.trim().toLowerCase();
          if (!p.name.ar.toLowerCase().includes(s) && !p.name.en.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s)) return false;
        }
        return true;
      });
  }, [products, categories, statusFilter, categoryFilter, search]);

  const onDelete = () => {
    if (pendingDelete == null) return;
    getStore().softDeleteProduct(pendingDelete);
    setPendingDelete(null);
  };

  return (
    <AdminShell
      title="المنتجات"
      crumbs={[{ label: "المنتجات" }]}
      actions={
        <Link href="/products/new" className="btn btn--primary btn--sm">
          <Icon.Plus /> منتج جديد
        </Link>
      }
    >
      <div className="toolbar toolbar--stacked">
        <div className="toolbar__search">
          <div className="search">
            <Icon.Search />
            <input
              placeholder="ابحثي بالاسم أو SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="muted toolbar__count">{filtered.length} منتج</div>
        <div className="toolbar__filter1">
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>
        <div className="toolbar__filter2">
          <select className="select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : "")}>
            <option value="">كل الأقسام</option>
            {rootCats.map((c) => <option key={c.id} value={c.id}>{c.name.ar}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-outer">
        <table className="table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>الاسم</th>
              <th>SKU</th>
              <th>القسم</th>
              <th>السعر</th>
              <th>المخزون</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              const prices = p.variants.map((v) => v.price);
              const stockSum = p.variants.reduce((acc, v) => acc + v.stock, 0);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="avatar-tile">
                      {p.name.en[0]}
                    </div>
                  </td>
                  <td>
                    <Link href={`/products/${p.id}/edit`} className="table-title">{p.name.ar}</Link>
                    <div className="table-subtitle">{p.name.en}</div>
                  </td>
                  <td><code className="mono">{p.sku}</code></td>
                  <td>{cat?.name.ar ?? "—"}</td>
                  <td>{prices.length > 1 ? formatPriceRange(Math.min(...prices), Math.max(...prices), "ar") : formatPrice(prices[0] ?? 0, "ar")}</td>
                  <td>
                    {stockSum === 0 ? <span className="status status--deleted">نفد</span>
                      : stockSum < 10 ? <span className="status status--draft">{stockSum}</span>
                      : <span className="status status--active">{stockSum}</span>}
                  </td>
                  <td>
                    {p.status === "active"
                      ? <span className="status status--active">نشط</span>
                      : <span className="status status--inactive">غير نشط</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setToggleError(null);
                          setPendingToggle(p);
                        }}
                        title={p.status === "active" ? "إيقاف" : "تفعيل"}
                      >
                        {p.status === "active" ? <Icon.X /> : <Icon.Check />}
                      </button>
                      <Link href={`/products/${p.id}/edit`} className="btn btn--ghost btn--sm"><Icon.Edit /></Link>
                      <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(p.id)} style={{ color: "var(--danger)" }}>
                        <Icon.Trash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>لا توجد منتجات تطابق الفلتر.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Modal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={() => {
          if (isToggling) return;
          setPendingToggle(null);
          setToggleError(null);
        }}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" disabled={isToggling} onClick={() => { setPendingToggle(null); setToggleError(null); }}>إلغاء</button>
            <button
              className="btn btn--primary btn--sm"
              disabled={isToggling}
              onClick={async () => {
                if (!pendingToggle) return;
                try {
                  setIsToggling(true);
                  setToggleError(null);
                  await getStore().toggleProductStatus(pendingToggle.id);
                  setPendingToggle(null);
                } catch (error) {
                  console.error(error);
                  showErrorToast(error, "تعذر تحديث حالة المنتج. حاولي مرة أخرى.");
                  setToggleError("تعذر تحديث حالة المنتج. حاولي مرة أخرى.");
                } finally {
                  setIsToggling(false);
                }
              }}
            >
              {isToggling ? "جارٍ التحديث..." : "تأكيد"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذا المنتج ولن يظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذا المنتج ليظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p style={{ margin: "12px 0 0", color: "var(--danger)" }}>{toggleError}</p> : null}
      </Modal>

      <Modal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(null)}>إلغاء</button>
            <button className="btn btn--danger btn--sm" onClick={onDelete}>حذف المنتج</button>
          </>
        }
      >
        <p style={{ margin: 0 }}>سيتم نقل المنتج إلى المحذوفات. يمكنك استعادته لاحقًا من قسم المحذوفات.</p>
      </Modal>
    </AdminShell>
  );
}
