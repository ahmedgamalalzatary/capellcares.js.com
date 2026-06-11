import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar
} from "drizzle-orm/mysql-core";

export const relatedItemEntityTypes = ["product", "offer", "collection"] as const;

export const relatedItemTargetTypes = ["product", "offer", "collection"] as const;

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  parentId: int("parent_id"),
  // MySQL unique indexes treat NULLs as distinct, so root categories need a
  // generated parent scope key to make sibling-scoped slug uniqueness enforceable.
  parentScopeId: int("parent_scope_id").generatedAlwaysAs(
    sql`(coalesce(\`parent_id\`, 0))`,
    { mode: "stored" }
  ),
  slug: varchar("slug", { length: 191 }).notNull(),
  arName: varchar("ar_name", { length: 255 }).notNull(),
  enName: varchar("en_name", { length: 255 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isLeaf: boolean("is_leaf").notNull().default(false),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  categoryParentScopeSlugUnique: unique("categories_parent_scope_slug_unique").on(
    table.parentScopeId,
    table.slug
  )
}));

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
  categoryId: int("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const productVariants = mysqlTable(
  "product_variants",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sizeLabel: varchar("size_label", { length: 64 }).notNull(),
    sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
    stockQty: int("stock_qty").notNull().default(0),
    sortOrder: int("sort_order").notNull().default(0),
    deletedAt: datetime("deleted_at"),
    // Uniqueness must ignore soft-deleted rows: a deleted 100ml variant must not
    // block creating a new 100ml variant for the same product. MySQL has no
    // partial unique index, so we key uniqueness off a generated column that is
    // NULL for soft-deleted rows (multiple NULLs are allowed in a unique index).
    activeSizeLabel: varchar("active_size_label", { length: 64 }).generatedAlwaysAs(
      sql`(case when \`deleted_at\` is null then \`size_label\` else null end)`,
      { mode: "stored" }
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
  },
  (table) => ({
    productActiveSizeUnique: unique("product_variants_active_size_unique").on(
      table.productId,
      table.activeSizeLabel
    )
  })
);

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

export const collections = mysqlTable("collections", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 191 }).notNull().unique(),
  arName: varchar("ar_name", { length: 255 }).notNull(),
  enName: varchar("en_name", { length: 255 }).notNull(),
  arDescription: text("ar_description"),
  enDescription: text("en_description"),
  imagePath: varchar("image_path", { length: 1024 }),
  fixedPrice: decimal("fixed_price", { precision: 10, scale: 2 }).notNull(),
  categoryId: int("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
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

export const offerItems = mysqlTable(
  "offer_items",
  {
    id: int("id").autoincrement().primaryKey(),
    offerId: int("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    variantId: int("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    qty: int("qty").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    offerVariantUnique: unique("offer_items_offer_variant_unique").on(
      table.offerId,
      table.variantId
    )
  })
);

export const collectionItems = mysqlTable(
  "collection_items",
  {
    id: int("id").autoincrement().primaryKey(),
    collectionId: int("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    variantId: int("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    qty: int("qty").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    collectionVariantUnique: unique("collection_items_collection_variant_unique").on(
      table.collectionId,
      table.variantId
    )
  })
);

export const relatedItems = mysqlTable(
  "related_items",
  {
    id: int("id").autoincrement().primaryKey(),
    sourceType: mysqlEnum("source_type", relatedItemEntityTypes).notNull(),
    sourceId: int("source_id").notNull(),
    targetType: mysqlEnum("target_type", relatedItemEntityTypes).notNull(),
    targetId: int("target_id").notNull(),
    rank: int("rank").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    relatedItemsLinkUnique: unique("related_items_link_unique").on(
      table.sourceType,
      table.sourceId,
      table.targetType,
      table.targetId
    )
  })
);

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
  role: mysqlEnum("role", ["admin", "staff"]).notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 191 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const adminUserPermissions = mysqlTable(
  "admin_user_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    adminUserId: int("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
    permissionId: int("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    adminUserPermissionUnique: unique("admin_user_permissions_unique").on(
      table.adminUserId,
      table.permissionId
    )
  })
);

export const authSessions = mysqlTable("auth_sessions", {
  id: int("id").autoincrement().primaryKey(),
  accountType: mysqlEnum("account_type", ["customer", "admin"]).notNull(),
  customerId: int("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  adminUserId: int("admin_user_id").references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: datetime("expires_at").notNull(),
  revokedAt: datetime("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});

export const wishlists = mysqlTable(
  "wishlists",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    customerProductUnique: unique("wishlists_customer_product_unique").on(
      table.customerId,
      table.productId
    )
  })
);

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderCode: varchar("order_code", { length: 32 }).notNull().unique(),
  customerType: mysqlEnum("customer_type", ["guest", "registered"]).notNull(),
  customerId: int("customer_id").references(() => customers.id, { onDelete: "set null" }),
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
  orderId: int("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  itemType: mysqlEnum("item_type", ["product_variant", "offer", "collection"]).notNull(),
  variantId: int("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
  offerId: int("offer_id").references(() => offers.id, { onDelete: "restrict" }),
  collectionId: int("collection_id").references(() => collections.id, { onDelete: "restrict" }),
  qty: int("qty").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  snapshotNameAr: varchar("snapshot_name_ar", { length: 255 }),
  snapshotNameEn: varchar("snapshot_name_en", { length: 255 }),
  snapshotSizeLabel: varchar("snapshot_size_label", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
});
