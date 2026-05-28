import {
  boolean,
  datetime,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parent_id"),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  arName: varchar("ar_name", { length: 255 }).notNull(),
  enName: varchar("en_name", { length: 255 }).notNull(),
  isLeaf: boolean("is_leaf").notNull().default(false),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 128 }).notNull().unique(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  arName: varchar("ar_name", { length: 255 }).notNull(),
  enName: varchar("en_name", { length: 255 }).notNull(),
  buyingPrice: decimal("buying_price", { precision: 10, scale: 2 }).notNull(),
  keywords: text("keywords").notNull(),
  arDescription: text("ar_description"),
  enDescription: text("en_description"),
  arIngredients: text("ar_ingredients"),
  enIngredients: text("en_ingredients"),
  arHowToUse: text("ar_how_to_use"),
  enHowToUse: text("en_how_to_use"),
  arWarnings: text("ar_warnings"),
  enWarnings: text("en_warnings"),
  youtubeUrl: varchar("youtube_url", { length: 1024 }),
  imagePath: varchar("image_path", { length: 1024 }),
  hoverImagePath: varchar("hover_image_path", { length: 1024 }),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("inactive"),
  isNew: boolean("is_new").notNull().default(false),
  isBestseller: boolean("is_bestseller").notNull().default(false),
  categoryId: int("category_id").notNull(),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const productVariants = mysqlTable("product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sizeLabel: varchar("size_label", { length: 64 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  stockQty: int("stock_qty").notNull().default(0),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const productMedia = mysqlTable("product_media", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  mediaType: mysqlEnum("media_type", ["image", "video"]).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  arName: varchar("ar_name", { length: 255 }).notNull(),
  enName: varchar("en_name", { length: 255 }).notNull(),
  arDescription: text("ar_description"),
  enDescription: text("en_description"),
  imagePath: varchar("image_path", { length: 1024 }),
  fixedPrice: decimal("fixed_price", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("inactive"),
  visibility: mysqlEnum("visibility", ["visible", "hidden"]).notNull().default("visible"),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const advices = mysqlTable("advices", {
  id: int("id").autoincrement().primaryKey(),
  arTitle: varchar("ar_title", { length: 255 }).notNull(),
  enTitle: varchar("en_title", { length: 255 }).notNull(),
  arDescription: text("ar_description").notNull(),
  enDescription: text("en_description").notNull(),
  imagePath: varchar("image_path", { length: 1024 }),
  videoUrl: varchar("video_url", { length: 1024 }),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("inactive"),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const offerItems = mysqlTable("offer_items", {
  id: int("id").autoincrement().primaryKey(),
  offerId: int("offer_id").notNull(),
  variantId: int("variant_id").notNull(),
  qty: int("qty").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const adminUsers = mysqlTable("admin_users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin"]).notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const authSessions = mysqlTable("auth_sessions", {
  id: int("id").autoincrement().primaryKey(),
  accountType: mysqlEnum("account_type", ["customer", "admin"]).notNull(),
  customerId: int("customer_id"),
  adminUserId: int("admin_user_id"),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: datetime("expires_at").notNull(),
  revokedAt: datetime("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id").notNull(),
  productId: int("product_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderCode: varchar("order_code", { length: 32 }).notNull().unique(),
  customerType: mysqlEnum("customer_type", ["guest", "registered"]).notNull(),
  customerId: int("customer_id"),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  governorate: varchar("governorate", { length: 120 }).notNull(),
  cityArea: varchar("city_area", { length: 120 }).notNull(),
  addressLine: varchar("address_line", { length: 255 }).notNull(),
  buildingApartment: varchar("building_apartment", { length: 255 }).notNull(),
  notes: text("notes"),
  paymentMethod: mysqlEnum("payment_method", ["cod"]).notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending", "accepted", "denied"]).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  itemType: mysqlEnum("item_type", ["product_variant", "offer"]).notNull(),
  variantId: int("variant_id"),
  offerId: int("offer_id"),
  qty: int("qty").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  snapshotNameAr: varchar("snapshot_name_ar", { length: 255 }),
  snapshotNameEn: varchar("snapshot_name_en", { length: 255 }),
  snapshotSizeLabel: varchar("snapshot_size_label", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});
