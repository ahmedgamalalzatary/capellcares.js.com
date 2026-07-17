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
    bestDeal: "BEST DEAL",
    addToCart: "ADD TO CART",
    save: "SAVE"
  },
  pages: {
    products: "All Products",
    offers: "Offers",
    collections: "Collections",
    newArrivals: "New Arrivals",
    bestSellers: "Best Sellers",
    searchResultsFor: "Search results for",
    noResults: "No items found.",
    relatedItems: "You may also like"
  },
  bundle: {
    includes: "Includes",
    itemsCount: "items",
    quantity: "Quantity",
    inStock: "in stock",
    outOfStock: "Out of stock",
    added: "Added",
    viewDetails: "View details"
  },
  productDetail: {
    description: "Description",
    ingredients: "Ingredients",
    howToUse: "How to use",
    warnings: "Warnings"
  },
  cart: {
    title: "Your Cart",
    empty: "Your cart is empty.",
    continueShopping: "Continue shopping",
    quantity: "Qty",
    size: "Size",
    remove: "Remove",
    unavailable: "This item is no longer available",
    total: "Total",
    checkout: "Proceed to checkout",
    clear: "Clear cart"
  },
  checkout: {
    title: "Checkout",
    fullName: "Full name",
    phone: "Phone number",
    email: "Email",
    governorate: "Governorate",
    selectGovernorate: "Select a governorate",
    cityArea: "City / Area",
    addressLine: "Address",
    buildingApartment: "Building / Apartment",
    notes: "Notes (optional)",
    paymentMethod: "Payment method",
    cod: "Cash on delivery",
    orderSummary: "Order summary",
    placeOrder: "Place order",
    placing: "Placing order…",
    invalidPhone: "Enter a valid Egyptian phone number",
    successTitle: "Thank you! Your order is confirmed.",
    orderCode: "Order code",
    backToShop: "Back to shop"
  },
  wishlistPage: {
    title: "Wishlist",
    empty: "Your wishlist is empty.",
    browse: "Browse products"
  },
  auth: {
    loginTitle: "Log in",
    signupTitle: "Create account",
    name: "Name",
    email: "Email",
    password: "Password",
    login: "Log in",
    signup: "Sign up",
    submitting: "Please wait…",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    logout: "Log out"
  },
  footer: {
    aboutTitle: "About Minikoshk",
    aboutBody:
      "Our daily physical contact point with earth is our feet. This contact grounds us, takes us forward, offers us potential and, above all, carries us with our dreams, ambitions, duties & experiences. Minikoshk believes this contact, which we share as humans, should be all about comfort, ease, character, flexibility & freedom. Minikoshk celebrates the freedom to express what's possible in our lives.",
    socialLinks: "Social Links:",
    shopTitle: "Shop",
    accountTitle: "Your Account",
    policiesTitle: "Policies",
    policies: ["Privacy Policy", "Shipping Policy", "Return & Exchange"],
    copyright: "© 2026 MINIKOSHK · CRAFTED BY",
    craftedByName: "ZENITH WEAVE"
  }
} as const;
