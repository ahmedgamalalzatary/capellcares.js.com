/**
 * Đespacito Delight development catalogue.
 *
 * Real-shaped data for the four lines the shop actually sells — chocolate &
 * bon-bons, bakery, café, and nuts & dried fruit — so the storefront can be
 * developed and reviewed against plausible content instead of empty rows.
 *
 * Dev/staging only. Prices are indicative EGP, not a price list.
 */
import { categories, categoryPaths, productVariants, products } from "../../drizzle/schema.js";
import { db } from "../db.js";

type CategorySeed = {
  slug: string;
  en: string;
  ar: string;
  children: Array<{ slug: string; en: string; ar: string }>;
};

const CATEGORY_TREE: CategorySeed[] = [
  {
    slug: "chocolate",
    en: "Chocolate & Bon-bons",
    ar: "شوكولاتة وبونبون",
    children: [
      { slug: "bon-bons", en: "Bon-bons", ar: "بونبون" },
      { slug: "bars", en: "Bars", ar: "ألواح" },
      { slug: "gift-boxes", en: "Gift boxes", ar: "علب هدايا" }
    ]
  },
  {
    slug: "bakery",
    en: "Bakery",
    ar: "مخبوزات",
    children: [
      { slug: "cakes", en: "Cakes", ar: "تورت" },
      { slug: "pastries", en: "Pastries", ar: "معجنات" }
    ]
  },
  {
    slug: "cafe",
    en: "Café",
    ar: "قهوة",
    children: [
      { slug: "coffee-beans", en: "Coffee beans", ar: "حبوب قهوة" },
      { slug: "drinks", en: "Drinks", ar: "مشروبات" }
    ]
  },
  {
    slug: "nuts",
    en: "Nuts & Dried Fruit",
    ar: "مكسرات وفواكه مجففة",
    children: [
      { slug: "roasted-nuts", en: "Roasted nuts", ar: "مكسرات محمصة" },
      { slug: "dried-fruit", en: "Dried fruit", ar: "فواكه مجففة" }
    ]
  }
];

type ProductSeed = {
  sku: string;
  slug: string;
  en: string;
  ar: string;
  category: string;
  enDesc: string;
  arDesc: string;
  keywords: string;
  isNew?: boolean;
  isBestseller?: boolean;
  buying: string;
  /** Served by the API from apps/api/uploads (see uploads/CREDITS.json). */
  image?: string;
  hover?: string;
  variants: Array<{ label: string; price: string; stock: number }>;
};

const PRODUCTS: ProductSeed[] = [
  {
    sku: "DSP-BON-012",
    slug: "milk-chocolate-bon-bons",
    en: "Milk Chocolate Bon-bons",
    ar: "بونبون شوكولاتة بالحليب",
    category: "bon-bons",
    enDesc: "Soft praline centres in milk chocolate, boxed to order the day you buy them.",
    arDesc: "حشوة برالين طرية بشوكولاتة الحليب، تُعبَّأ حسب الطلب في يوم الشراء.",
    keywords: "bon-bons, chocolate, praline, gift, بونبون, شوكولاتة",
    isBestseller: true,
    image: "/uploads/milk-chocolate-bon-bons.jpg",
    buying: "120.00",
    variants: [
      { label: "12 pieces", price: "260.00", stock: 40 },
      { label: "24 pieces", price: "480.00", stock: 22 }
    ]
  },
  {
    sku: "DSP-BON-020",
    slug: "almond-dark-bon-bons",
    en: "Dark Almond Bon-bons",
    ar: "بونبون دارك باللوز",
    category: "bon-bons",
    enDesc: "Roasted almond in 70% dark chocolate. Less sweet, and the one regulars reorder.",
    arDesc: "لوز محمص في شوكولاتة دارك ٧٠٪. أقل حلاوة، وهو الأكثر تكرارًا بين العملاء.",
    keywords: "dark chocolate, almond, bon-bons, دارك, لوز",
    isBestseller: true,
    image: "/uploads/almond-dark-bon-bons.jpg",
    hover: "/uploads/almond-dark-bon-bons-2.jpg",
    buying: "140.00",
    variants: [
      { label: "12 pieces", price: "290.00", stock: 30 },
      { label: "24 pieces", price: "540.00", stock: 14 }
    ]
  },
  {
    sku: "DSP-BAR-004",
    slug: "pistachio-milk-bar",
    en: "Pistachio Milk Bar",
    ar: "لوح شوكولاتة بالفستق",
    category: "bars",
    enDesc: "Milk chocolate with whole Egyptian pistachios, poured in small batches.",
    arDesc: "شوكولاتة بالحليب مع فستق مصري كامل، تُصب في دفعات صغيرة.",
    keywords: "bar, pistachio, milk chocolate, فستق, لوح",
    isNew: true,
    image: "/uploads/pistachio-milk-bar.jpg",
    buying: "70.00",
    variants: [{ label: "100 g", price: "165.00", stock: 60 }]
  },
  {
    sku: "DSP-GFT-001",
    slug: "despacito-bon-gift-box",
    en: "Đespacito Bon Gift Box",
    ar: "علبة هدايا ديسباسيتو بون",
    category: "gift-boxes",
    enDesc: "The pink box from the shop window: an assortment of bon-bons, ribbon tied.",
    arDesc: "العلبة الوردية من فاترينة المحل: تشكيلة بونبون مربوطة بشريطة.",
    keywords: "gift, box, assortment, هدية, علبة",
    isBestseller: true,
    image: "/uploads/despacito-bon-gift-box.jpg",
    hover: "/uploads/despacito-bon-gift-box-2.jpg",
    buying: "260.00",
    variants: [
      { label: "Medium", price: "550.00", stock: 18 },
      { label: "Large", price: "890.00", stock: 9 }
    ]
  },
  {
    sku: "DSP-CAK-007",
    slug: "belgian-chocolate-cake",
    en: "Belgian Chocolate Cake",
    ar: "تورتة شوكولاتة بلجيكية",
    category: "cakes",
    enDesc: "Four layers, dark ganache. Needs 24 hours' notice.",
    arDesc: "أربع طبقات مع غاناش دارك. تحتاج طلبًا قبلها بـ ٢٤ ساعة.",
    keywords: "cake, chocolate, ganache, birthday, تورت, شوكولاتة",
    image: "/uploads/belgian-chocolate-cake.jpg",
    hover: "/uploads/belgian-chocolate-cake-2.jpg",
    buying: "320.00",
    variants: [
      { label: "1 kg", price: "680.00", stock: 6 },
      { label: "2 kg", price: "1250.00", stock: 3 }
    ]
  },
  {
    sku: "DSP-PAS-011",
    slug: "butter-croissant",
    en: "Butter Croissant",
    ar: "كرواسون بالزبدة",
    category: "pastries",
    enDesc: "Laminated with real butter, baked through the morning.",
    arDesc: "عجين مورّق بزبدة حقيقية، يُخبز على مدار الصباح.",
    keywords: "croissant, pastry, butter, breakfast, كرواسون, معجنات",
    isNew: true,
    image: "/uploads/butter-croissant.jpg",
    hover: "/uploads/butter-croissant-2.jpg",
    buying: "18.00",
    variants: [
      { label: "Each", price: "45.00", stock: 80 },
      { label: "Box of 6", price: "250.00", stock: 20 }
    ]
  },
  {
    sku: "DSP-COF-003",
    slug: "house-espresso-beans",
    en: "House Espresso Beans",
    ar: "حبوب إسبريسو المحل",
    category: "coffee-beans",
    enDesc: "The blend we pull in the café. Medium roast, cocoa and hazelnut.",
    arDesc: "الخلطة التي نستخدمها في المحل. تحميص وسط، بنكهة كاكاو وبندق.",
    keywords: "coffee, espresso, beans, roast, قهوة, إسبريسو",
    isBestseller: true,
    image: "/uploads/house-espresso-beans.jpg",
    buying: "180.00",
    variants: [
      { label: "250 g", price: "290.00", stock: 45 },
      { label: "1 kg", price: "980.00", stock: 12 }
    ]
  },
  {
    sku: "DSP-DRK-009",
    slug: "iced-spanish-latte",
    en: "Iced Spanish Latte",
    ar: "آيس سبانيش لاتيه",
    category: "drinks",
    enDesc: "Espresso over condensed milk and ice. Made at the counter.",
    arDesc: "إسبريسو على لبن مكثف ومثلج. يُحضّر عند البار.",
    keywords: "latte, iced, coffee, drink, لاتيه, قهوة",
    isNew: true,
    image: "/uploads/iced-spanish-latte.jpg",
    hover: "/uploads/iced-spanish-latte-2.jpg",
    buying: "22.00",
    variants: [{ label: "Large", price: "85.00", stock: 100 }]
  },
  {
    sku: "DSP-NUT-015",
    slug: "roasted-mixed-nuts",
    en: "Roasted Mixed Nuts",
    ar: "مكسرات مشكلة محمصة",
    category: "roasted-nuts",
    enDesc: "Almond, cashew, and pistachio, roasted unsalted in-house.",
    arDesc: "لوز وكاجو وفستق، محمصة بدون ملح في المحل.",
    keywords: "nuts, almond, cashew, pistachio, مكسرات, لوز",
    isBestseller: true,
    image: "/uploads/roasted-mixed-nuts.jpg",
    buying: "210.00",
    variants: [
      { label: "500 g", price: "420.00", stock: 35 },
      { label: "1 kg", price: "790.00", stock: 16 }
    ]
  },
  {
    sku: "DSP-DRF-006",
    slug: "dried-apricot",
    en: "Dried Apricot",
    ar: "مشمش مجفف",
    category: "dried-fruit",
    enDesc: "Whole soft apricots, no added sugar. A Ramadan staple.",
    arDesc: "مشمش كامل وطري، بدون سكر مضاف. أساسي في رمضان.",
    keywords: "apricot, dried fruit, ramadan, مشمش, فواكه مجففة",
    image: "/uploads/dried-apricot.jpg",
    buying: "95.00",
    variants: [{ label: "500 g", price: "195.00", stock: 50 }]
  }
];

export async function seedDespacito() {
  // Categories: roots first, then children, then the closure-table paths the
  // category pages walk (self at depth 0, parent link at depth 1).
  const idBySlug = new Map<string, number>();

  for (const [index, root] of CATEGORY_TREE.entries()) {
    const [inserted] = await db
      .insert(categories)
      .values({
        slug: root.slug,
        enName: root.en,
        arName: root.ar,
        isLeaf: false,
        sortOrder: index
      })
      .$returningId();
    idBySlug.set(root.slug, inserted.id);
  }

  for (const root of CATEGORY_TREE) {
    const parentId = idBySlug.get(root.slug)!;
    for (const [index, child] of root.children.entries()) {
      const [inserted] = await db
        .insert(categories)
        .values({
          slug: child.slug,
          enName: child.en,
          arName: child.ar,
          parentId,
          isLeaf: true,
          sortOrder: index
        })
        .$returningId();
      idBySlug.set(child.slug, inserted.id);
    }
  }

  const pathRows: Array<{ ancestorId: number; descendantId: number; depth: number }> = [];
  for (const root of CATEGORY_TREE) {
    const rootId = idBySlug.get(root.slug)!;
    pathRows.push({ ancestorId: rootId, descendantId: rootId, depth: 0 });
    for (const child of root.children) {
      const childId = idBySlug.get(child.slug)!;
      pathRows.push({ ancestorId: childId, descendantId: childId, depth: 0 });
      pathRows.push({ ancestorId: rootId, descendantId: childId, depth: 1 });
    }
  }
  await db.insert(categoryPaths).values(pathRows);

  for (const item of PRODUCTS) {
    const categoryId = idBySlug.get(item.category);
    if (!categoryId) throw new Error(`Unknown category slug: ${item.category}`);

    const [inserted] = await db
      .insert(products)
      .values({
        sku: item.sku,
        slug: item.slug,
        enName: item.en,
        arName: item.ar,
        buyingPrice: item.buying,
        keywords: item.keywords,
        enDescription: item.enDesc,
        arDescription: item.arDesc,
        imagePath: item.image ?? null,
        hoverImagePath: item.hover ?? null,
        status: "active",
        isNew: item.isNew ?? false,
        isBestseller: item.isBestseller ?? false,
        categoryId
      })
      .$returningId();

    await db.insert(productVariants).values(
      item.variants.map((variant, index) => ({
        productId: inserted.id,
        sizeLabel: variant.label,
        sellingPrice: variant.price,
        stockQty: variant.stock,
        sortOrder: index
      }))
    );
  }

  return { categories: idBySlug.size, products: PRODUCTS.length };
}
