// Storefront UI copy (English). Keep this lean: only keys that a live component
// actually renders. Add more as features land — see ar.ts for the mirror.
export const en = {
  brand: "Minikoshk",
  langSwitch: { ar: "العربية", en: "English", short: "EN" },
  header: {
    menu: {
      home: "HOME",
      newArrivals: "NEW ARRIVALS",
      women: "WOMEN",
      men: "MEN",
      kids: "KIDS",
      collection: "COLLECTION",
      sale: "SALE"
    },
    secondary: { aboutUs: "ABOUT US", contact: "CONTACT" },
    toggleMenu: "Toggle menu",
    wishlist: "Wishlist",
    cart: "Cart",
    account: "Account",
    search: "Search",
    searchPlaceholder: "What are you looking for?",
    hotline: "16772",
    announcements: [
      "Get 3 Zanooba for 1199 EGP",
      "Any 3 EVA Pieces for only 999 EGP",
      "2nd item -15% | 3rd item -30% | Free Shipping 800+ EGP | +15% with Card",
      "Get 3 Classics for 1199 EGP"
    ]
  },
  shop: {
    shopByCategoryTop: "Shop by",
    shopByCategoryBottom: "Category",
    newArrivalsTop: "NEW",
    newArrivalsBottom: "ARRIVALS",
    bestSellersTop: "BEST",
    bestSellersBottom: "SELLERS",
    viewAll: "View All"
  },
  product: {
    currency: "EGP",
    wishlist: "Add to wishlist",
    new: "NEW",
    payWithCard: "PAY WITH CARD",
    discount: "15% OFF",
    freeShipping: "FREE SHIPPING",
    cardPrice: "Card Price",
    bestDeal: "BEST DEAL"
  },
  footer: {
    aboutTitle: "About Minikoshk",
    aboutBody:
      "Our daily physical contact point with earth is our feet. This contact grounds us, takes us forward, offers us potential and, above all, carries us with our dreams, ambitions, duties & experiences. Minikoshk believes this contact, which we share as humans, should be all about comfort, ease, character, flexibility & freedom. Minikoshk celebrates the freedom to express what's possible in our lives.",
    socialLinks: "Social Links:",
    categoriesTitle: "Categories",
    categories: ["Men", "Women", "Kids", "New Arrivals", "Sales"],
    usefulLinksTitle: "Useful Links",
    usefulLinks: ["About Us", "Contact Us", "Orders", "My Account"],
    policiesTitle: "Policies",
    policies: ["Privacy Policy", "Shipping Policy", "Return & Exchange"],
    copyright: "© 2026 MINIKOSHK · CRAFTED BY",
    craftedByName: "ZENITH WEAVE"
  }
} as const;
