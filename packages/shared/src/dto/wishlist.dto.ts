export interface WishlistItemDto {
  id: number;
  customerId: number;
  entityType: "product" | "offer" | "collection";
  entityId: number;
  createdAt?: string;
}

export interface WishlistEntryDto {
  entityType: "product" | "offer" | "collection";
  entityId: number;
  name: { ar: string; en: string };
  imagePath: string | null;
  href: string | null;
  availability: "available" | "unavailable";
}
