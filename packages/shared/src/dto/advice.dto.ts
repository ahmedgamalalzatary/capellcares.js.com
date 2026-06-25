export interface AdviceDto {
  id: number;
  title: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  videoUrl: string;
  status: "active" | "inactive";
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}
