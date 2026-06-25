"use client";

import { useState } from "react";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { ImageUpload } from "@/components/forms/image-upload";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { hasErpPermission } from "@/lib/erp-permissions";
import { getStore, useStore } from "@/lib/store";

type SectionKey = "hero_primary" | "grid_featured" | "single_mid" | "hero_secondary" | "single_footer";

const SECTION_HINTS: Record<SectionKey, string> = {
  hero_primary: "Carousel with auto move, arrows, and dots",
  grid_featured: "Manual 4-up slider with arrows and dots",
  single_mid: "Single banner slot",
  hero_secondary: "Carousel with auto move, arrows, and dots",
  single_footer: "Single banner slot"
};

function createInitialDrafts(): Record<SectionKey, { imagePath: string; href: string }> {
  return {
    hero_primary: { imagePath: "", href: "" },
    grid_featured: { imagePath: "", href: "" },
    single_mid: { imagePath: "", href: "" },
    hero_secondary: { imagePath: "", href: "" },
    single_footer: { imagePath: "", href: "" }
  };
}

export default function HomepageBannersPage() {
  const { user } = useAdminAuth();
  const homepageSections = useStore((store) => store.homepageSections);
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  if (!hasErpPermission(user, "homepage_banners.read")) {
    return (
      <AdminShell title="بنرات الصفحة الرئيسية" crumbs={[{ label: "بنرات الصفحة الرئيسية" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى بنرات الصفحة الرئيسية." />
      </AdminShell>
    );
  }

  const editable = hasErpPermission(user, "homepage_banners.update");

  return (
    <AdminShell title="بنرات الصفحة الرئيسية" crumbs={[{ label: "بنرات الصفحة الرئيسية" }]}>
      <h2 style={{ margin: 0, fontSize: 0 }}>بنرات الصفحة الرئيسية</h2>
      <div style={{ display: "grid", gap: 16 }}>
        {(Object.keys(homepageSections) as SectionKey[]).map((sectionKey) => {
          const section = homepageSections[sectionKey];
          const draft = drafts[sectionKey];
          const singleSectionFull = section.maxItems === 1 && section.items.length >= 1;

          return (
            <div key={sectionKey} className="card">
              <div className="card__head">
                <div>
                  <h3 className="card__title">{section.title}</h3>
                  <p className="faint" style={{ margin: "6px 0 0" }}>
                    {SECTION_HINTS[sectionKey]}
                  </p>
                </div>
                <div className="faint">{section.items.length} صورة</div>
              </div>

              <div className="card__body" style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gap: 12,
                        padding: 12,
                        border: "1px solid var(--hairline)",
                        borderRadius: "var(--radius-lg)"
                      }}
                    >
                      <img
                        src={item.imagePath}
                        alt=""
                        style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }}
                      />
                      <input
                        className="input"
                        aria-label={`Link for item ${item.id}`}
                        defaultValue={item.href}
                        disabled={!editable || savingKey === `item-${item.id}`}
                        onBlur={(event) => {
                          const href = event.currentTarget.value.trim();
                          if (!editable || !href || href === item.href) {
                            event.currentTarget.value = item.href;
                            return;
                          }
                          setSavingKey(`item-${item.id}`);
                          void getStore()
                            .updateHomepageBannerItem(item.id, { href })
                            .finally(() => setSavingKey(null));
                        }}
                      />
                      {editable && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setSavingKey(`delete-${item.id}`);
                            void getStore()
                              .deleteHomepageBannerItem(item.id)
                              .finally(() => setSavingKey(null));
                          }}
                          disabled={savingKey != null}
                        >
                          حذف الصورة
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {editable && !singleSectionFull && (
                  <div style={{ display: "grid", gap: 12, borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
                    <ImageUpload
                      value={draft.imagePath || null}
                      onChange={(value) => setDrafts((current) => ({
                        ...current,
                        [sectionKey]: { ...current[sectionKey], imagePath: value ?? "" }
                      }))}
                      uploadContext="homepage_banners.update"
                    />
                    <input
                      className="input"
                      placeholder="https://... or /products/slug"
                      value={draft.href}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [sectionKey]: { ...current[sectionKey], href: event.target.value }
                      }))}
                    />
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={!draft.imagePath.trim() || !draft.href.trim() || savingKey === sectionKey}
                      onClick={() => {
                        setSavingKey(sectionKey);
                        void getStore()
                          .addHomepageBannerItem(sectionKey, {
                            imagePath: draft.imagePath.trim(),
                            href: draft.href.trim()
                          })
                          .then(() => {
                            setDrafts((current) => ({
                              ...current,
                              [sectionKey]: { imagePath: "", href: "" }
                            }));
                          })
                          .finally(() => setSavingKey(null));
                      }}
                    >
                      إضافة صورة
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}
