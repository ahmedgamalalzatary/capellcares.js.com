// Storefront UI copy (Arabic). Must mirror en.ts key-for-key so the Dict union
// stays consistent. Keep lean; grow alongside en.ts as features land.
export const ar = {
  brand: "ميني كشك",
  langSwitch: { ar: "العربية", en: "English", short: "ع" },
  header: {
    menu: {
      home: "الرئيسية",
      newArrivals: "وصل حديثًا",
      women: "نساء",
      men: "رجال",
      kids: "أطفال",
      collection: "المجموعة",
      sale: "تخفيضات"
    },
    secondary: { aboutUs: "من نحن", contact: "اتصل بنا" },
    toggleMenu: "فتح القائمة",
    wishlist: "المفضلة",
    cart: "السلة",
    account: "حسابي",
    search: "بحث",
    searchPlaceholder: "عمّا تبحث؟",
    announcements: [
      "اشترِ ٣ زنوبة بـ ١١٩٩ جنيه",
      "أي ٣ قطع EVA بـ ٩٩٩ جنيه فقط",
      "القطعة الثانية -١٥٪ | الثالثة -٣٠٪ | شحن مجاني فوق ٨٠٠ جنيه | +١٥٪ بالبطاقة",
      "اشترِ ٣ كلاسيك بـ ١١٩٩ جنيه"
    ]
  },
  shop: {
    shopByCategoryTop: "تسوّق حسب",
    shopByCategoryBottom: "القسم",
    newArrivalsTop: "وصل",
    newArrivalsBottom: "حديثًا",
    bestSellersTop: "الأكثر",
    bestSellersBottom: "مبيعًا",
    viewAll: "عرض الكل"
  },
  product: {
    currency: "ج.م",
    wishlist: "أضف للمفضلة",
    new: "جديد",
    payWithCard: "الدفع بالبطاقة",
    discount: "خصم ١٥٪",
    freeShipping: "شحن مجاني",
    cardPrice: "سعر البطاقة",
    bestDeal: "أفضل عرض",
    addToCart: "أضف إلى السلة",
    save: "وفّر"
  },
  footer: {
    aboutTitle: "عن ميني كشك",
    aboutBody:
      "نقطة تلامسنا اليومية مع الأرض هي أقدامنا. هذا التلامس يثبّتنا ويمضي بنا قدمًا ويمنحنا الإمكانات، وقبل كل شيء يحملنا بأحلامنا وطموحاتنا وواجباتنا وتجاربنا. تؤمن ميني كشك بأن هذا التلامس الذي نتشاركه كبشر يجب أن يكون كله راحةً وسهولةً وشخصيةً ومرونةً وحرية. تحتفي ميني كشك بحرية التعبير عمّا هو ممكن في حياتنا.",
    socialLinks: "تابعنا:",
    categoriesTitle: "الأقسام",
    categories: ["رجال", "نساء", "أطفال", "وصل حديثًا", "تخفيضات"],
    usefulLinksTitle: "روابط مفيدة",
    usefulLinks: ["من نحن", "اتصل بنا", "الطلبات", "حسابي"],
    policiesTitle: "السياسات",
    policies: ["سياسة الخصوصية", "سياسة الشحن", "الإرجاع والاستبدال"],
    copyright: "© ٢٠٢٦ ميني كشك · من إبداع",
    craftedByName: "ZENITH WEAVE"
  }
} as const;
