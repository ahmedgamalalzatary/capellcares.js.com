import { relations } from "drizzle-orm";
import {
  categories,
  customers,
  offerItems,
  offers,
  orderItems,
  orders,
  products,
  productVariants,
  wishlists
} from "./schema.js";

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  children: many(categories),
  products: many(products)
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  wishlists: many(wishlists)
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  offerItems: many(offerItems),
  orderItems: many(orderItems)
}));

export const offersRelations = relations(offers, ({ many }) => ({
  items: many(offerItems)
}));

export const offerItemsRelations = relations(offerItems, ({ one }) => ({
  offer: one(offers, { fields: [offerItems.offerId], references: [offers.id] }),
  variant: one(productVariants, { fields: [offerItems.variantId], references: [productVariants.id] })
}));

export const customersRelations = relations(customers, ({ many }) => ({
  wishlists: many(wishlists),
  orders: many(orders)
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  customer: one(customers, { fields: [wishlists.customerId], references: [customers.id] }),
  product: one(products, { fields: [wishlists.productId], references: [products.id] })
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems)
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] })
}));
