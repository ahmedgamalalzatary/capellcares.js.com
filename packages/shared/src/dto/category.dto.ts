export interface CategoryDto {
  id: number;
  parentId: number | null;
  slug: string;
  sortOrder?: number;
  arName: string;
  enName: string;
  imagePath: string | null;
  isLeaf: boolean;
  deletedAt: string | null;
}
