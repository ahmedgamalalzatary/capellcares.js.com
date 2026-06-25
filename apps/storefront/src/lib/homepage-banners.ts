import { resolveApiBase } from "@capella/shared/api/base";
import type { HomepageBannersDto } from "@capella/shared";

const API_BASE = resolveApiBase(process.env, { isServer: true });

function createEmptySections(): HomepageBannersDto["sections"] {
  return {
    hero_primary: { key: "hero_primary", title: "Section 1", behavior: "carousel", maxItems: null, items: [] },
    grid_featured: { key: "grid_featured", title: "Section 2", behavior: "manual-grid", maxItems: null, items: [] },
    single_mid: { key: "single_mid", title: "Section 3", behavior: "single-image", maxItems: 1, items: [] },
    hero_secondary: { key: "hero_secondary", title: "Section 4", behavior: "carousel", maxItems: null, items: [] },
    single_footer: { key: "single_footer", title: "Section 5", behavior: "single-image", maxItems: 1, items: [] }
  };
}

export async function getHomepageBanners(): Promise<HomepageBannersDto> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/homepage-banners`, { cache: "no-store" });
    if (!response.ok) {
      return { sections: createEmptySections() };
    }
    return response.json();
  } catch {
    return { sections: createEmptySections() };
  }
}
