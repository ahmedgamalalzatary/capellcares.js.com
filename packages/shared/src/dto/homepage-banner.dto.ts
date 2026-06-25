export type HomepageSectionKey =
  | "hero_primary"
  | "grid_featured"
  | "single_mid"
  | "hero_secondary"
  | "single_footer";

export type HomepageSectionBehavior = "carousel" | "manual-grid" | "single-image";

export interface HomepageBannerItemDto {
  id: number;
  imagePath: string;
  href: string;
  sortOrder: number;
}

export interface HomepageBannerSectionDto {
  key: HomepageSectionKey;
  title: string;
  behavior: HomepageSectionBehavior;
  maxItems: number | null;
  items: HomepageBannerItemDto[];
}

export interface HomepageBannersDto {
  sections: Record<HomepageSectionKey, HomepageBannerSectionDto>;
}
