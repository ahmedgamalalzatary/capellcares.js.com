export interface CategoryDto {
  id: number;
  parentId: number | null;
  slug: string;
  sortOrder?: number;
  arName: string;
  enName: string;
  isLeaf: boolean;
  deletedAt: string | null;
}
