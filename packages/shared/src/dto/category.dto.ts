export interface CategoryDto {
  id: number;
  parentId: number | null;
  slug: string;
  imagePath?: string | null;
  sortOrder?: number;
  arName: string;
  enName: string;
  isLeaf: boolean;
  deletedAt: string | null;
}
