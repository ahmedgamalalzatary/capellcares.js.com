export interface CollectionItemDto {
  id: number;
  collectionId: number;
  variantId: number;
  qty: number;
}

export interface CollectionDto {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  imagePath: string | null;
  fixedPrice: number;
  categoryId: number;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  deletedAt: string | null;
  items: CollectionItemDto[];
}
