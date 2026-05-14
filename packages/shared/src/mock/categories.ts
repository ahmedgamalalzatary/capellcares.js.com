import type { Category } from "../types";

type Seed = { id: number; parentId: number | null; slug: string; ar: string; en: string };

const seed: Seed[] = [
  { id: 1, parentId: null, slug: "new", ar: "وصل حديثًا", en: "New" },
  { id: 2, parentId: null, slug: "bestseller", ar: "الأكثر مبيعًا", en: "Bestseller" },
  { id: 3, parentId: null, slug: "body-care", ar: "العناية بالجسم", en: "Body Care" },
  { id: 4, parentId: null, slug: "skin-care", ar: "العناية بالبشرة", en: "Skin Care" },
  { id: 5, parentId: null, slug: "hair-care", ar: "العناية بالشعر", en: "Hair Care" },
  { id: 6, parentId: null, slug: "mens", ar: "للرجال", en: "Men's" },
  { id: 7, parentId: null, slug: "kids", ar: "للأطفال", en: "Kid's" },
  { id: 8, parentId: null, slug: "organic-oils", ar: "زيوت طبيعية", en: "Organic Oils" },
  { id: 9, parentId: null, slug: "soap", ar: "صابون", en: "Soap" },
  { id: 10, parentId: null, slug: "candles", ar: "شموع", en: "Candles" },
  { id: 11, parentId: null, slug: "fragrances", ar: "العطور", en: "Fragrances" },
  { id: 12, parentId: null, slug: "fresheners", ar: "معطرات الجو", en: "Fresheners" },
  { id: 13, parentId: null, slug: "makeup", ar: "مكياج", en: "Makeup" },
  { id: 14, parentId: null, slug: "accessories-tools", ar: "إكسسوارات وأدوات", en: "Accessories & Tools" },

  // Body Care
  { id: 100, parentId: 3, slug: "body-lotion", ar: "لوشن الجسم", en: "Body Lotion" },
  { id: 101, parentId: 3, slug: "body-mist", ar: "بخاخ معطر للجسم", en: "Body Mist" },
  { id: 102, parentId: 3, slug: "body-oils", ar: "زيوت الجسم", en: "Body Oils" },
  { id: 103, parentId: 3, slug: "body-cream", ar: "كريم الجسم", en: "Body Cream" },
  { id: 104, parentId: 3, slug: "body-butter", ar: "زبدة الجسم", en: "Body Butter" },
  { id: 105, parentId: 3, slug: "hand-care", ar: "العناية باليدين", en: "Hand Care" },
  { id: 106, parentId: 3, slug: "foot-care", ar: "العناية بالقدمين", en: "Foot Care" },
  { id: 107, parentId: 3, slug: "body-scrub", ar: "مقشر الجسم", en: "Body Scrub" },
  { id: 108, parentId: 3, slug: "bubble-bath", ar: "حمام رغوة", en: "Bubble Bath" },
  { id: 109, parentId: 3, slug: "body-wash", ar: "غسول الجسم", en: "Body Wash & Shower Gel" },

  // Skin Care
  { id: 200, parentId: 4, slug: "skin-serum", ar: "سيروم البشرة", en: "Skin Serum" },
  { id: 201, parentId: 4, slug: "skin-oils", ar: "زيوت البشرة", en: "Skin Oils" },
  { id: 202, parentId: 4, slug: "skin-cream", ar: "كريم البشرة", en: "Skin Cream" },
  { id: 203, parentId: 4, slug: "barrier-cream", ar: "كريم حماية", en: "Barrier Cream" },
  { id: 204, parentId: 4, slug: "exfoliators", ar: "مقشرات", en: "Exfoliators & Peels" },
  { id: 205, parentId: 4, slug: "cleansers-toners", ar: "غسول وتونر", en: "Cleansers & Toners" },
  { id: 206, parentId: 4, slug: "face-masks", ar: "ماسكات الوجه", en: "Face Masks" },
  { id: 207, parentId: 4, slug: "eye-care", ar: "العناية بالعين", en: "Eye Care" },
  { id: 208, parentId: 4, slug: "lip-care", ar: "العناية بالشفاه", en: "Lip Care" },
  { id: 209, parentId: 4, slug: "skin-treatments", ar: "علاجات البشرة", en: "Skin Treatments" },
  { id: 210, parentId: 4, slug: "skin-routines", ar: "روتين البشرة", en: "Skincare Routines" },
  { id: 211, parentId: 4, slug: "by-skin-type", ar: "حسب نوع البشرة", en: "By Skin Type" },
  { id: 2110, parentId: 211, slug: "oily-skin", ar: "بشرة دهنية", en: "Oily Skin" },
  { id: 2111, parentId: 211, slug: "dry-skin", ar: "بشرة جافة", en: "Dry Skin" },
  { id: 2112, parentId: 211, slug: "combination-skin", ar: "بشرة مختلطة", en: "Combination Skin" },
  { id: 2113, parentId: 211, slug: "sensitive-skin", ar: "بشرة حساسة", en: "Sensitive Skin" },
  { id: 2114, parentId: 211, slug: "normal-skin", ar: "بشرة عادية", en: "Normal Skin" },

  // Hair Care
  { id: 300, parentId: 5, slug: "hair-serum", ar: "سيروم الشعر", en: "Hair Serum" },
  { id: 301, parentId: 5, slug: "hair-oils", ar: "زيوت الشعر", en: "Hair Oils" },
  { id: 302, parentId: 5, slug: "hair-masks", ar: "ماسكات الشعر", en: "Hair Masks" },
  { id: 303, parentId: 5, slug: "hair-tonic", ar: "تونيك الشعر", en: "Hair Tonic" },
  { id: 304, parentId: 5, slug: "shampoo", ar: "شامبو", en: "Shampoo" },
  { id: 305, parentId: 5, slug: "conditioner", ar: "بلسم", en: "Conditioner" },
  { id: 306, parentId: 5, slug: "hair-treatments", ar: "علاجات الشعر", en: "Hair Treatments" },
  { id: 307, parentId: 5, slug: "hair-routines", ar: "روتين الشعر", en: "Hair Routines" },
  { id: 308, parentId: 5, slug: "by-hair-type", ar: "حسب نوع الشعر", en: "By Hair Type" },
  { id: 3080, parentId: 308, slug: "dry-hair", ar: "شعر جاف", en: "Dry Hair" },
  { id: 3081, parentId: 308, slug: "oily-hair", ar: "شعر دهني", en: "Oily Hair" },
  { id: 3082, parentId: 308, slug: "frizzy-hair", ar: "شعر مجعد", en: "Frizzy Hair" },
  { id: 3083, parentId: 308, slug: "damaged-hair", ar: "شعر تالف", en: "Damaged Hair" },

  // Makeup
  { id: 400, parentId: 13, slug: "foundations-concealers", ar: "كريم الأساس والكونسيلر", en: "Foundations & Concealers" },
  { id: 401, parentId: 13, slug: "lips", ar: "الشفاه", en: "Lips" },
  { id: 402, parentId: 13, slug: "eyeliners-eyebrows", ar: "آيلاينر وحواجب", en: "Eyeliners & Eyebrows" },
  { id: 403, parentId: 13, slug: "cheeks", ar: "الخدود", en: "Cheeks" },
  { id: 404, parentId: 13, slug: "bronzing", ar: "برونزر", en: "Bronzing" },

  // Fragrances
  { id: 500, parentId: 11, slug: "for-her", ar: "لها", en: "For Her" },
  { id: 501, parentId: 11, slug: "for-him", ar: "له", en: "For Him" },

  // Accessories & Tools
  { id: 600, parentId: 14, slug: "acc-body", ar: "الجسم", en: "Body" },
  { id: 601, parentId: 14, slug: "acc-skin", ar: "البشرة", en: "Skin" },
  { id: 602, parentId: 14, slug: "acc-hair", ar: "الشعر", en: "Hair" }
];

const childMap = new Map<number | null, number[]>();
for (const c of seed) {
  const list = childMap.get(c.parentId) ?? [];
  list.push(c.id);
  childMap.set(c.parentId, list);
}

export const categories: Category[] = seed.map((c) => ({
  id: c.id,
  parentId: c.parentId,
  slug: c.slug,
  name: { ar: c.ar, en: c.en },
  isLeaf: !childMap.has(c.id)
}));

const byId = new Map(categories.map((c) => [c.id, c]));
const bySlug = new Map(categories.map((c) => [c.slug, c]));

export function getCategoryById(id: number): Category | undefined {
  return byId.get(id);
}
export function getCategoryBySlug(slug: string): Category | undefined {
  return bySlug.get(slug);
}

export function getCategoryPath(id: number): Category[] {
  const path: Category[] = [];
  let cur = byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

export function getDescendantCategoryIds(id: number): number[] {
  const out: number[] = [id];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const children = childMap.get(cur);
    if (children) {
      out.push(...children);
      stack.push(...children);
    }
  }
  return out;
}

export const leafCategories = categories.filter((c) => c.isLeaf);
