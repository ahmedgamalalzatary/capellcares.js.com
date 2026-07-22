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
    searchPlaceholder: "عمّا تبحث؟"
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
  pages: {
    products: "كل المنتجات",
    offers: "العروض",
    collections: "المجموعات",
    newArrivals: "وصل حديثًا",
    bestSellers: "الأكثر مبيعًا",
    searchResultsFor: "نتائج البحث عن",
    noResults: "لا توجد عناصر.",
    relatedItems: "قد يعجبك أيضًا"
  },
  bundle: {
    includes: "يتضمن",
    itemsCount: "عناصر",
    quantity: "الكمية",
    inStock: "متوفر",
    outOfStock: "غير متوفر",
    added: "تمت الإضافة",
    viewDetails: "عرض التفاصيل"
  },
  productDetail: {
    description: "الوصف",
    ingredients: "المكونات",
    howToUse: "طريقة الاستخدام",
    warnings: "تحذيرات"
  },
  cart: {
    title: "سلة التسوق",
    empty: "سلتك فارغة.",
    continueShopping: "مواصلة التسوق",
    quantity: "الكمية",
    size: "المقاس",
    remove: "إزالة",
    unavailable: "هذا العنصر لم يعد متاحًا",
    total: "الإجمالي",
    checkout: "إتمام الطلب",
    clear: "إفراغ السلة"
  },
  checkout: {
    title: "إتمام الطلب",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    governorate: "المحافظة",
    selectGovernorate: "اختر المحافظة",
    cityArea: "المدينة / المنطقة",
    addressLine: "العنوان",
    buildingApartment: "المبنى / الشقة",
    notes: "ملاحظات (اختياري)",
    paymentMethod: "طريقة الدفع",
    cod: "الدفع عند الاستلام",
    orderSummary: "ملخص الطلب",
    placeOrder: "تأكيد الطلب",
    placing: "جارٍ تأكيد الطلب…",
    invalidPhone: "أدخل رقم هاتف مصري صحيح",
    successTitle: "شكرًا لك! تم تأكيد طلبك.",
    orderCode: "رقم الطلب",
    backToShop: "العودة للتسوق"
  },
  wishlistPage: {
    title: "المفضلة",
    empty: "قائمة المفضلة فارغة.",
    browse: "تصفّح المنتجات"
  },
  auth: {
    loginTitle: "تسجيل الدخول",
    signupTitle: "إنشاء حساب",
    name: "الاسم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    login: "دخول",
    signup: "تسجيل",
    submitting: "برجاء الانتظار…",
    noAccount: "ليس لديك حساب؟",
    haveAccount: "لديك حساب بالفعل؟",
    logout: "تسجيل الخروج"
  },
  footer: {
    aboutTitle: "عن ميني كشك",
    aboutBody:
      "نقطة تلامسنا اليومية مع الأرض هي أقدامنا. هذا التلامس يثبّتنا ويمضي بنا قدمًا ويمنحنا الإمكانات، وقبل كل شيء يحملنا بأحلامنا وطموحاتنا وواجباتنا وتجاربنا. تؤمن ميني كشك بأن هذا التلامس الذي نتشاركه كبشر يجب أن يكون كله راحةً وسهولةً وشخصيةً ومرونةً وحرية. تحتفي ميني كشك بحرية التعبير عمّا هو ممكن في حياتنا.",
    socialLinks: "تابعنا:",
    shopTitle: "تسوّق",
    accountTitle: "حسابك",
    policiesTitle: "السياسات",
    policies: ["سياسة الخصوصية", "سياسة الشحن", "الإرجاع والاستبدال"],
    copyright: "© ٢٠٢٦ ميني كشك · من إبداع",
    craftedByName: "ZENITH WEAVE"
  }
} as const;
