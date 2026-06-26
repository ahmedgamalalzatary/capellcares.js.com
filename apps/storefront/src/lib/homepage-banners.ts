import { resolveApiBase } from "@capella/shared/api/base";
import type { HomepageBannersDto } from "@capella/shared";

const API_BASE = resolveApiBase(process.env, { isServer: true });

const HOMEPAGE_SECTION_KEYS = [
  "hero_primary",
  "grid_featured",
  "single_mid",
  "hero_secondary",
  "single_footer"
] as const;

function createEmptySections(): HomepageBannersDto["sections"] {
  return {
    hero_primary: { key: "hero_primary", title: "Section 1", behavior: "carousel", maxItems: null, items: [] },
    grid_featured: { key: "grid_featured", title: "Section 2", behavior: "manual-grid", maxItems: null, items: [] },
    single_mid: { key: "single_mid", title: "Section 3", behavior: "single-image", maxItems: 1, items: [] },
    hero_secondary: { key: "hero_secondary", title: "Section 4", behavior: "carousel", maxItems: null, items: [] },
    single_footer: { key: "single_footer", title: "Section 5", behavior: "single-image", maxItems: 1, items: [] }
  };
}

function normalizeHomepageBanners(payload: unknown): HomepageBannersDto {
  if (!payload || typeof payload !== "object" || !("sections" in payload)) {
    return { sections: createEmptySections() };
  }

  const sections = (payload as { sections?: unknown }).sections;
  if (!sections || typeof sections !== "object") {
    return { sections: createEmptySections() };
  }

  const normalizedSections = createEmptySections();
  for (const sectionKey of HOMEPAGE_SECTION_KEYS) {
    const sectionValue = (sections as Record<string, unknown>)[sectionKey];
    if (!sectionValue || typeof sectionValue !== "object") {
      continue;
    }

    const items = Array.isArray((sectionValue as { items?: unknown[] }).items)
      ? (sectionValue as { items: unknown[] }).items
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const typedItem = item as {
              id?: unknown;
              imagePath?: unknown;
              href?: unknown;
              sortOrder?: unknown;
            };

            return typeof typedItem.id === "number" &&
                typeof typedItem.imagePath === "string" &&
                typedItem.imagePath.trim() &&
                typeof typedItem.href === "string" &&
                typedItem.href.trim() &&
                typeof typedItem.sortOrder === "number"
              ? {
                  id: typedItem.id,
                  imagePath: typedItem.imagePath.trim(),
                  href: typedItem.href.trim(),
                  sortOrder: typedItem.sortOrder
                }
              : null;
          })
          .filter((item): item is HomepageBannersDto["sections"][typeof sectionKey]["items"][number] => item != null)
      : [];

    normalizedSections[sectionKey] = {
      ...normalizedSections[sectionKey],
      items
    };
  }

  return { sections: normalizedSections };
}

export async function getHomepageBanners(): Promise<HomepageBannersDto> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/homepage-banners`, { cache: "no-store" });
    if (!response.ok) {
      return { sections: createEmptySections() };
    }
    return normalizeHomepageBanners(await response.json());
  } catch {
    return { sections: createEmptySections() };
  }
}
