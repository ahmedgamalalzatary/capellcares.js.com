export interface CategoryDto {
  id: number;
  parentId: number | null;
  slug: string;
  arName: string;
  enName: string;
  isLeaf: boolean;
  deletedAt: string | null;
}
