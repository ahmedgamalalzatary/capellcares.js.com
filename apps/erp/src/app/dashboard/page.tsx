"use client";

import Link from "next/link";
import { AdminShell } from "@/components/shell/admin-shell";
import { useStore } from "@/lib/store";
import { formatPrice } from "@capella/shared";
import { Icon } from "@/components/ui/icons";

export default function DashboardPage() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const offers = useStore((s) => s.offers);

  const activeProducts = products.filter((p) => !p.deletedAt && p.status === "active");
  const totalVariants = products.reduce((acc, p) => acc + (p.deletedAt ? 0 : p.variants.length), 0);
  const lowStock = products.flatMap((p) => p.deletedAt ? [] : p.variants.filter((v) => v.stock > 0 && v.stock <= 5).map((v) => ({ p, v })));
  const outOfStock = products.flatMap((p) => p.deletedAt ? [] : p.variants.filter((v) => v.stock === 0).map((v) => ({ p, v })));

  return (
    <AdminShell title="لوحة التحكم">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Stat label="المنتجات النشطة" value={activeProducts.length} hint={`من إجمالي ${products.length}`} accent="var(--accent)" />
        <Stat label="المتغيرات" value={totalVariants} hint="مقاسات وأحجام" accent="var(--accent-2)" />
        <Stat label="العروض النشطة" value={offers.filter((o) => !o.deletedAt).length} hint={`من إجمالي ${offers.length}`} accent="var(--gold)" />
        <Stat label="الأقسام" value={categories.filter((c) => !c.deletedAt).length} hint="تشمل الأقسام الفرعية" accent="var(--info)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <section className="card">
          <div className="card__head">
            <h3 className="card__title">إجراءات سريعة</h3>
          </div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Action href="/products/new" icon={<Icon.Plus />} title="منتج جديد" desc="ابدئي بإنشاء منتج جديد." />
            <Action href="/offers/new" icon={<Icon.Tag />} title="عرض جديد" desc="جمّعي منتجات في باقة." />
            <Action href="/categories/new" icon={<Icon.Folder />} title="قسم جديد" desc="أضيفي قسمًا فرعيًا." />
            <Action href="/products" icon={<Icon.Box />} title="إدارة المنتجات" desc="تحديث المخزون والحالة." />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h3 className="card__title">تنبيهات المخزون</h3>
            <span className="muted" style={{ fontSize: 12 }}>{lowStock.length + outOfStock.length} عنصر</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            <table className="table">
              <tbody>
                {outOfStock.slice(0, 5).map(({ p, v }) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/products/${p.id}/edit`} style={{ fontWeight: 600 }}>{p.name.ar}</Link>
                      <div className="faint" style={{ fontSize: 11 }}>{v.size}</div>
                    </td>
                    <td style={{ textAlign: "end" }}><span className="status status--deleted">نفد</span></td>
                  </tr>
                ))}
                {lowStock.slice(0, 6).map(({ p, v }) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/products/${p.id}/edit`} style={{ fontWeight: 600 }}>{p.name.ar}</Link>
                      <div className="faint" style={{ fontSize: 11 }}>{v.size}</div>
                    </td>
                    <td style={{ textAlign: "end" }}><span className="status status--draft">{v.stock}</span></td>
                  </tr>
                ))}
                {lowStock.length === 0 && outOfStock.length === 0 && (
                  <tr><td className="muted" style={{ padding: 20, textAlign: "center" }}>كل المخزون بحالة جيدة.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__head">
          <h3 className="card__title">آخر المنتجات</h3>
          <Link href="/products" className="btn btn--ghost btn--sm">عرض الكل</Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكود</th>
              <th>القسم</th>
              <th>المتغيرات</th>
              <th>السعر</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 5).map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              const prices = p.variants.map((v) => v.price);
              const min = Math.min(...prices); const max = Math.max(...prices);
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/products/${p.id}/edit`} style={{ fontWeight: 600 }}>{p.name.ar}</Link>
                    <div className="faint" style={{ fontSize: 11 }}>{p.name.en}</div>
                  </td>
                  <td><code style={{ fontSize: 12 }}>{p.sku}</code></td>
                  <td>{cat?.name.ar ?? "—"}</td>
                  <td>{p.variants.length}</td>
                  <td>{min === max ? formatPrice(min, "ar") : `${formatPrice(min, "ar")} – ${formatPrice(max, "ar")}`}</td>
                  <td>
                    {p.deletedAt
                      ? <span className="status status--deleted">محذوف</span>
                      : p.status === "active"
                        ? <span className="status status--active">نشط</span>
                        : <span className="status status--inactive">غير نشط</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: number; hint: string; accent: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: accent }}>{value}</div>
      <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function Action({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} style={{ display: "flex", gap: 12, padding: 14, border: "1px solid var(--hairline)", borderRadius: 8, transition: "border-color 0.12s" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="faint" style={{ fontSize: 12 }}>{desc}</div>
      </div>
    </Link>
  );
}
