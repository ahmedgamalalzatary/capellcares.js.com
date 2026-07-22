export interface AnnouncementItemDto {
  id: number;
  text: {
    ar: string;
    en: string;
  };
  isActive: boolean;
  sortOrder: number;
}

export interface AnnouncementBarDto {
  enabled: boolean;
  items: AnnouncementItemDto[];
}
