import type { EntityMediaDto } from "./product.dto.js";
import type { HoverImageDto } from "./hover-image.dto.js";

export interface OfferItemDto {
  id: number;
  offerId: number;
  variantId: number;
  qty: number;
}

export interface OfferDto extends HoverImageDto {
  id: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription: string | null;
  enDescription: string | null;
  youtubeUrl: string | null;
  imagePath: string | null;
  media: EntityMediaDto[];
  fixedPrice: number;
  categoryId: number | null;
  status: "active" | "inactive";
  visibility: "visible" | "hidden";
  deletedAt: string | null;
  items: OfferItemDto[];
}
