import { asc, eq } from "drizzle-orm";
import { homepageBannerItems } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import type {
  HomepageBannerItemDto,
  HomepageBannersDto,
  HomepageSectionBehavior,
  HomepageSectionKey
} from "@minikoshk/shared";

const SECTION_CONFIG: Record<
  HomepageSectionKey,
  { title: string; behavior: HomepageSectionBehavior; maxItems: number | null; single: boolean }
> = {
  hero_primary: {
    title: "Section 1",
    behavior: "carousel",
    maxItems: null,
    single: false
  },
  grid_featured: {
    title: "Section 2",
    behavior: "manual-grid",
    maxItems: null,
    single: false
  },
  single_mid: {
    title: "Section 3",
    behavior: "single-image",
    maxItems: 1,
    single: true
  },
  hero_secondary: {
    title: "Section 4",
    behavior: "carousel",
    maxItems: null,
    single: false
  },
  single_footer: {
    title: "Section 5",
    behavior: "single-image",
    maxItems: 1,
    single: true
  }
};

export function isHomepageSectionKey(value: string): value is HomepageSectionKey {
  return value in SECTION_CONFIG;
}

function toItemDto(item: typeof homepageBannerItems.$inferSelect): HomepageBannerItemDto {
  return {
    id: item.id,
    imagePath: item.imagePath,
    href: item.href,
    sortOrder: item.sortOrder
  };
}

export async function listHomepageBanners(): Promise<HomepageBannersDto> {
  const rows = await db.select().from(homepageBannerItems).orderBy(
    asc(homepageBannerItems.sectionKey),
    asc(homepageBannerItems.sortOrder),
    asc(homepageBannerItems.id)
  );

  const grouped = rows.reduce<Record<HomepageSectionKey, HomepageBannerItemDto[]>>((acc, row) => {
    acc[row.sectionKey].push(toItemDto(row));
    return acc;
  }, {
    hero_primary: [],
    grid_featured: [],
    single_mid: [],
    hero_secondary: [],
    single_footer: []
  });

  return {
    sections: {
      hero_primary: { key: "hero_primary", ...SECTION_CONFIG.hero_primary, items: grouped.hero_primary },
      grid_featured: { key: "grid_featured", ...SECTION_CONFIG.grid_featured, items: grouped.grid_featured },
      single_mid: { key: "single_mid", ...SECTION_CONFIG.single_mid, items: grouped.single_mid },
      hero_secondary: { key: "hero_secondary", ...SECTION_CONFIG.hero_secondary, items: grouped.hero_secondary },
      single_footer: { key: "single_footer", ...SECTION_CONFIG.single_footer, items: grouped.single_footer }
    }
  };
}

export async function createHomepageBannerItem(input: {
  sectionKey: HomepageSectionKey;
  imagePath: string;
  href: string;
}) {
  if (SECTION_CONFIG[input.sectionKey].single) {
    const existing = await db
      .select({ id: homepageBannerItems.id })
      .from(homepageBannerItems)
      .where(eq(homepageBannerItems.sectionKey, input.sectionKey))
      .limit(1);

    if (existing.length > 0) {
      return { ok: false as const, reason: "single-section-limit" as const };
    }
  }

  const existingItems = await db
    .select({ id: homepageBannerItems.id })
    .from(homepageBannerItems)
    .where(eq(homepageBannerItems.sectionKey, input.sectionKey));

  await db.insert(homepageBannerItems).values({
    sectionKey: input.sectionKey,
    imagePath: input.imagePath,
    href: input.href,
    sortOrder: existingItems.length
  });

  return { ok: true as const };
}

export async function updateHomepageBannerItem(
  id: number,
  input: { href: string; imagePath?: string | null }
) {
  const [existing] = await db
    .select()
    .from(homepageBannerItems)
    .where(eq(homepageBannerItems.id, id))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db.update(homepageBannerItems)
    .set({
      href: input.href,
      imagePath: input.imagePath?.trim() ? input.imagePath : existing.imagePath
    })
    .where(eq(homepageBannerItems.id, id));
  return true;
}

export async function deleteHomepageBannerItem(id: number) {
  const [existing] = await db
    .select()
    .from(homepageBannerItems)
    .where(eq(homepageBannerItems.id, id))
    .limit(1);

  if (!existing) {
    return false;
  }

  await db.delete(homepageBannerItems).where(eq(homepageBannerItems.id, id));
  return true;
}
