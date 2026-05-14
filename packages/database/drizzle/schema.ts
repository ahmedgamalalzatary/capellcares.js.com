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
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("inactive"),
  categoryId: int("category_id").notNull(),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const productVariants = mysqlTable("product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  sizeLabel: varchar("size_label", { length: 64 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  stockQty: int("stock_qty").notNull().default(0),
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
  deletedAt: datetime("deleted_at"),
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

export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id").notNull(),
  productId: int("product_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  customerType: mysqlEnum("customer_type", ["guest", "registered"]).notNull(),
  customerId: int("customer_id"),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  governorate: varchar("governorate", { length: 120 }).notNull(),
  cityArea: varchar("city_area", { length: 120 }).notNull(),
  addressLine: varchar("address_line", { length: 255 }).notNull(),
  buildingApartment: varchar("building_apartment", { length: 255 }).notNull(),
  notes: text("notes").notNull(),
  paymentMethod: mysqlEnum("payment_method", ["cod", "paymob"]).notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending", "paid", "failed"]).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  variantId: int("variant_id").notNull(),
  qty: int("qty").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull()
});
