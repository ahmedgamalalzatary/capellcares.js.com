import type { Product } from "../types";
import { getDescendantCategoryIds } from "./categories";

const now = "2026-01-15T10:00:00Z";

function p(p: Omit<Product, "createdAt" | "updatedAt" | "deletedAt">): Product {
  return { ...p, createdAt: now, updatedAt: now, deletedAt: null };
}

export const products: Product[] = [
  p({
    id: 1,
    sku: "BODY-LOTION-ROSE",
    slug: "rose-petal-body-lotion",
    name: { ar: "لوشن الجسم بخلاصة الورد", en: "Rose Petal Body Lotion" },
    description: {
      ar: "لوشن مرطب خفيف بخلاصة الورد الدمشقي، يترك بشرتك ناعمة بعطر يدوم.",
      en: "A weightless rose lotion that drinks straight into skin and leaves a soft, lingering scent."
    },
    ingredients: {
      ar: "ماء، زبدة الشيا، زيت الجوجوبا، خلاصة الورد، فيتامين هـ.",
      en: "Aqua, Shea Butter, Jojoba Oil, Rose Extract, Vitamin E."
    },
    howToUse: {
      ar: "ضعي كمية مناسبة على بشرة نظيفة ودلكي حتى الامتصاص.",
      en: "Massage onto clean skin daily, especially after a shower."
    },
    warnings: {
      ar: "للاستخدام الخارجي فقط. تجنب ملامسة العين.",
      en: "For external use only. Avoid contact with eyes."
    },
    keywords: ["rose", "lotion", "body", "ورد", "لوشن"],
    buyingPrice: 120,
    imagePath: "/images/products/rose-lotion.svg",
    status: "active",
    categoryId: 100,
    variants: [
      { id: 11, productId: 1, size: "100ml", price: 220, stock: 24, sortOrder: 1 },
      { id: 12, productId: 1, size: "200ml", price: 360, stock: 12, sortOrder: 2 },
      { id: 13, productId: 1, size: "400ml", price: 620, stock: 4, sortOrder: 3 }
    ],
    offerIds: [1]
  }),
  p({
    id: 2,
    sku: "SKIN-SERUM-VITC",
    slug: "vitamin-c-radiance-serum",
    name: { ar: "سيروم فيتامين سي للإشراق", en: "Vitamin C Radiance Serum" },
    description: {
      ar: "سيروم مركز بفيتامين سي لإشراق فوري ومظهر موحد.",
      en: "A 15% Vitamin C serum that wakes up dull skin and evens out tone over time."
    },
    ingredients: {
      ar: "حمض الأسكوربيك، حمض الهيالورونيك، نياسيناميد.",
      en: "Ascorbic Acid, Hyaluronic Acid, Niacinamide."
    },
    howToUse: {
      ar: "قطرتان على بشرة نظيفة صباحًا قبل الكريم وواقي الشمس.",
      en: "Two drops on clean skin in the morning, before moisturizer and SPF."
    },
    warnings: {
      ar: "استخدمي واقي شمس يوميًا.",
      en: "Always pair with daily sunscreen."
    },
    keywords: ["serum", "vitamin c", "glow", "سيروم", "فيتامين سي"],
    buyingPrice: 280,
    imagePath: "/images/products/vitamin-c.svg",
    status: "active",
    categoryId: 200,
    variants: [
      { id: 21, productId: 2, size: "30ml", price: 480, stock: 18, sortOrder: 1 },
      { id: 22, productId: 2, size: "50ml", price: 720, stock: 7, sortOrder: 2 }
    ],
    offerIds: [2]
  }),
  p({
    id: 3,
    sku: "HAIR-OIL-ARGAN",
    slug: "argan-shine-hair-oil",
    name: { ar: "زيت الأرغان للمعان الشعر", en: "Argan Shine Hair Oil" },
    description: {
      ar: "زيت أرغان نقي يغذي الشعر ويمنحه لمعانًا طبيعيًا دون ثقل.",
      en: "Pure argan oil that nourishes hair and adds shine without any greasy weight."
    },
    ingredients: {
      ar: "زيت الأرغان، فيتامين هـ.",
      en: "Argan Oil, Vitamin E."
    },
    howToUse: {
      ar: "ضعي بضع قطرات على أطراف الشعر بعد الاستحمام.",
      en: "Apply a few drops to damp hair, focusing on the ends."
    },
    warnings: {
      ar: "للاستخدام الخارجي فقط.",
      en: "For external use only."
    },
    keywords: ["argan", "hair", "shine", "أرغان", "زيت"],
    buyingPrice: 95,
    imagePath: "/images/products/argan-oil.svg",
    status: "active",
    categoryId: 301,
    variants: [
      { id: 31, productId: 3, size: "50ml", price: 180, stock: 30, sortOrder: 1 },
      { id: 32, productId: 3, size: "100ml", price: 300, stock: 0, sortOrder: 2 }
    ],
    offerIds: [2]
  }),
  p({
    id: 4,
    sku: "BODY-SCRUB-COFFEE",
    slug: "coffee-body-scrub",
    name: { ar: "مقشر القهوة للجسم", en: "Coffee Body Scrub" },
    description: {
      ar: "مقشر قهوة منعش يزيل خلايا الجلد الميتة ويترك بشرتك ناعمة.",
      en: "An energizing coffee scrub that sloughs away dull skin and leaves a soft glow."
    },
    ingredients: { ar: "بن مطحون، زيت جوز الهند، سكر بني.", en: "Ground Coffee, Coconut Oil, Brown Sugar." },
    howToUse: { ar: "افركي بحركات دائرية على البشرة المبللة، ثم اشطفي.", en: "Massage onto damp skin in circular motions, then rinse." },
    warnings: { ar: "تجنبي البشرة المتهيجة.", en: "Avoid use on irritated skin." },
    keywords: ["scrub", "coffee", "exfoliate", "مقشر", "قهوة"],
    buyingPrice: 60,
    imagePath: "/images/products/coffee-scrub.svg",
    status: "active",
    categoryId: 107,
    variants: [
      { id: 41, productId: 4, size: "150ml", price: 140, stock: 14, sortOrder: 1 },
      { id: 42, productId: 4, size: "300ml", price: 240, stock: 9, sortOrder: 2 }
    ]
  }),
  p({
    id: 5,
    sku: "LIP-BALM-VANILLA",
    slug: "vanilla-honey-lip-balm",
    name: { ar: "بلسم الشفاه بالفانيليا والعسل", en: "Vanilla Honey Lip Balm" },
    description: {
      ar: "بلسم مرطب بنكهة الفانيليا والعسل، يحمي شفتيك على مدار اليوم.",
      en: "A creamy vanilla-honey balm that locks in moisture all day."
    },
    ingredients: { ar: "زبدة الكاكاو، عسل النحل، فانيليا.", en: "Cocoa Butter, Honey, Vanilla." },
    howToUse: { ar: "ضعي كلما احتجت.", en: "Apply whenever lips need it." },
    warnings: { ar: "—", en: "—" },
    keywords: ["lip", "balm", "vanilla", "بلسم", "شفاه"],
    buyingPrice: 25,
    imagePath: "/images/products/lip-balm.svg",
    status: "active",
    categoryId: 208,
    variants: [{ id: 51, productId: 5, size: "10g", price: 80, stock: 50, sortOrder: 1 }]
  }),
  p({
    id: 6,
    sku: "FRAG-ROSE-OUD",
    slug: "rose-oud-eau-de-parfum",
    name: { ar: "عطر ورد وعود", en: "Rose & Oud Eau de Parfum" },
    description: {
      ar: "مزيج فاخر من الورد الدمشقي والعود، يبقى عليك طوال اليوم.",
      en: "A rich blend of Damask rose and oud that lingers all day."
    },
    ingredients: { ar: "كحول، ماء، عطور.", en: "Alcohol, Aqua, Parfum." },
    howToUse: { ar: "رشّي على المعصمين وخلف الأذنين.", en: "Spray on wrists and behind ears." },
    warnings: { ar: "قابل للاشتعال.", en: "Flammable." },
    keywords: ["perfume", "rose", "oud", "عطر", "عود"],
    buyingPrice: 320,
    imagePath: "/images/products/rose-oud.svg",
    status: "active",
    categoryId: 500,
    variants: [
      { id: 61, productId: 6, size: "30ml", price: 550, stock: 8, sortOrder: 1 },
      { id: 62, productId: 6, size: "50ml", price: 780, stock: 6, sortOrder: 2 },
      { id: 63, productId: 6, size: "100ml", price: 1200, stock: 0, sortOrder: 3 }
    ]
  }),
  p({
    id: 7,
    sku: "SOAP-OATMEAL",
    slug: "oatmeal-honey-soap-bar",
    name: { ar: "صابون الشوفان والعسل", en: "Oatmeal & Honey Soap Bar" },
    description: {
      ar: "صابون يدوي بالشوفان والعسل لتنظيف لطيف.",
      en: "A handmade oatmeal soap that cleans gently without stripping skin."
    },
    ingredients: { ar: "شوفان، عسل، زيت زيتون.", en: "Oats, Honey, Olive Oil." },
    howToUse: { ar: "استخدمي على الوجه أو الجسم.", en: "Use on face or body." },
    warnings: { ar: "—", en: "—" },
    keywords: ["soap", "oatmeal", "honey", "صابون", "شوفان"],
    buyingPrice: 30,
    imagePath: "/images/products/oatmeal-soap.svg",
    status: "active",
    categoryId: 9,
    variants: [{ id: 71, productId: 7, size: "120g", price: 70, stock: 80, sortOrder: 1 }]
  }),
  p({
    id: 8,
    sku: "CANDLE-AMBER",
    slug: "amber-soy-candle",
    name: { ar: "شمعة العنبر بالصويا", en: "Amber Soy Candle" },
    description: {
      ar: "شمعة صويا فاخرة بعطر العنبر، احتراق نظيف لساعات طويلة.",
      en: "A clean-burning soy candle with a warm amber scent."
    },
    ingredients: { ar: "شمع صويا، عطور، فتيل قطن.", en: "Soy Wax, Parfum, Cotton Wick." },
    howToUse: { ar: "اشعليها لمدة لا تزيد عن 3 ساعات.", en: "Burn for no more than 3 hours at a time." },
    warnings: { ar: "لا تترك بدون رقابة.", en: "Never leave unattended." },
    keywords: ["candle", "amber", "soy", "شمعة", "عنبر"],
    buyingPrice: 90,
    imagePath: "/images/products/amber-candle.svg",
    status: "active",
    categoryId: 10,
    variants: [
      { id: 81, productId: 8, size: "200g", price: 180, stock: 22, sortOrder: 1 },
      { id: 82, productId: 8, size: "400g", price: 320, stock: 10, sortOrder: 2 }
    ]
  }),
  p({
    id: 9,
    sku: "OIL-COCONUT-PURE",
    slug: "pure-coconut-oil",
    name: { ar: "زيت جوز الهند النقي", en: "Pure Coconut Oil" },
    description: {
      ar: "زيت جوز هند بكر متعدد الاستخدامات للشعر والبشرة.",
      en: "Cold-pressed virgin coconut oil for hair, skin, and lips."
    },
    ingredients: { ar: "زيت جوز الهند البكر.", en: "Virgin Coconut Oil." },
    howToUse: { ar: "استخدمي حسب الحاجة.", en: "Use as needed." },
    warnings: { ar: "يتجمد في درجات الحرارة الباردة.", en: "May solidify in cool temperatures." },
    keywords: ["coconut", "oil", "organic", "جوز الهند", "زيت"],
    buyingPrice: 70,
    imagePath: "/images/products/coconut-oil.svg",
    status: "active",
    categoryId: 8,
    variants: [
      { id: 91, productId: 9, size: "250ml", price: 150, stock: 16, sortOrder: 1 },
      { id: 92, productId: 9, size: "500ml", price: 270, stock: 5, sortOrder: 2 }
    ]
  }),
  p({
    id: 10,
    sku: "MAKE-LIP-MATTE-NUDE",
    slug: "matte-lipstick-desert-nude",
    name: { ar: "أحمر شفاه مطفي – نود صحراوي", en: "Matte Lipstick — Desert Nude" },
    description: {
      ar: "أحمر شفاه مطفي مريح ينعم على الشفاه ويثبت طويلاً.",
      en: "Comfort-matte lipstick that wears soft and stays put."
    },
    ingredients: { ar: "أوكسيد الزنك، شمع كرنوبا، عطور.", en: "Zinc Oxide, Carnauba Wax, Parfum." },
    howToUse: { ar: "ضعي طبقة واحدة على الشفاه.", en: "Apply directly to clean lips." },
    warnings: { ar: "—", en: "—" },
    keywords: ["lipstick", "matte", "nude", "أحمر شفاه"],
    buyingPrice: 110,
    imagePath: "/images/products/lipstick.svg",
    status: "active",
    categoryId: 401,
    variants: [{ id: 101, productId: 10, size: "3.5g", price: 220, stock: 18, sortOrder: 1 }]
  }),
  p({
    id: 11,
    sku: "BODY-BUTTER-COCOA",
    slug: "cocoa-body-butter",
    name: { ar: "زبدة الجسم بالكاكاو", en: "Cocoa Body Butter" },
    description: {
      ar: "زبدة جسم كثيفة بالكاكاو ترطب وتغذي البشرة الجافة.",
      en: "Whipped cocoa butter that wraps dry skin in long-lasting hydration."
    },
    ingredients: { ar: "زبدة الكاكاو، زبدة الشيا، فيتامين هـ.", en: "Cocoa Butter, Shea Butter, Vitamin E." },
    howToUse: { ar: "ضعي على بشرة جافة أو رطبة.", en: "Smooth onto clean skin morning or night." },
    warnings: { ar: "—", en: "—" },
    keywords: ["butter", "cocoa", "body", "زبدة", "كاكاو"],
    buyingPrice: 85,
    imagePath: "/images/products/cocoa-butter.svg",
    status: "active",
    categoryId: 104,
    variants: [
      { id: 111, productId: 11, size: "150ml", price: 200, stock: 0, sortOrder: 1 },
      { id: 112, productId: 11, size: "300ml", price: 340, stock: 0, sortOrder: 2 }
    ]
  }),
  p({
    id: 12,
    sku: "SHAMPOO-MINT",
    slug: "fresh-mint-shampoo",
    name: { ar: "شامبو النعناع المنعش", en: "Fresh Mint Shampoo" },
    description: {
      ar: "شامبو منعش بالنعناع يوازن فروة الرأس ويترك الشعر نظيفًا.",
      en: "Cooling mint shampoo that balances the scalp and leaves hair feeling fresh."
    },
    ingredients: { ar: "ماء، خلاصة النعناع، سلفات لطيفة.", en: "Aqua, Mint Extract, Mild Surfactants." },
    howToUse: { ar: "دلكي على الشعر المبلل، ثم اشطفي.", en: "Massage into wet hair, then rinse thoroughly." },
    warnings: { ar: "لتجنب ملامسة العين.", en: "Avoid contact with eyes." },
    keywords: ["shampoo", "mint", "scalp", "شامبو", "نعناع"],
    buyingPrice: 75,
    imagePath: "/images/products/mint-shampoo.svg",
    status: "active",
    categoryId: 304,
    variants: [
      { id: 121, productId: 12, size: "250ml", price: 150, stock: 22, sortOrder: 1 },
      { id: 122, productId: 12, size: "500ml", price: 270, stock: 11, sortOrder: 2 }
    ]
  })
];

const bySlug = new Map(products.map((p) => [p.slug, p]));

export function getProductBySlug(slug: string): Product | undefined {
  return bySlug.get(slug);
}

export function getProductsByCategory(categoryId: number): Product[] {
  const ids = new Set(getDescendantCategoryIds(categoryId));
  return products.filter((p) => p.status === "active" && !p.deletedAt && ids.has(p.categoryId));
}

export function searchProducts(query: string, lang: "ar" | "en"): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => {
    const name = (lang === "ar" ? p.name.ar : p.name.en).toLowerCase();
    return name.includes(q);
  });
}
