-- 0006 DB integrity: foreign keys + uniqueness + product_variants soft-delete.
-- Hand-authored (drizzle generate was discarded due to snapshot drift from the
-- hand-written 0001-0005 migrations). See docs/plans/2026-05-30-db-integrity-design.md.
--
-- Cleanup of existing violating rows is a DEV-PHASE choice (production is empty);
-- it is not a general production-safe pattern.

-- 1. Delete orphan products whose category is missing (cascades variants/media).
DELETE p FROM `products` p
LEFT JOIN `categories` c ON p.`category_id` = c.`id`
WHERE c.`id` IS NULL;
--> statement-breakpoint

-- 2. Delete orphan offer_items whose offer or variant is missing (NOT NULL cols).
DELETE oi FROM `offer_items` oi
LEFT JOIN `offers` o ON oi.`offer_id` = o.`id`
WHERE o.`id` IS NULL;
--> statement-breakpoint
DELETE oi FROM `offer_items` oi
LEFT JOIN `product_variants` v ON oi.`variant_id` = v.`id`
WHERE v.`id` IS NULL;
--> statement-breakpoint

-- 3. Null pre-existing orphan order_items references so RESTRICT FKs can attach.
--    (Cleanup of dangling dev data only; runtime policy is RESTRICT, never auto-null.)
UPDATE `order_items` oi
LEFT JOIN `product_variants` v ON oi.`variant_id` = v.`id`
SET oi.`variant_id` = NULL
WHERE oi.`variant_id` IS NOT NULL AND v.`id` IS NULL;
--> statement-breakpoint
UPDATE `order_items` oi
LEFT JOIN `offers` o ON oi.`offer_id` = o.`id`
SET oi.`offer_id` = NULL
WHERE oi.`offer_id` IS NOT NULL AND o.`id` IS NULL;
--> statement-breakpoint

-- 4. Normalize size_label (trim + collapse internal whitespace) before uniqueness.
UPDATE `product_variants`
SET `size_label` = TRIM(REGEXP_REPLACE(`size_label`, '[[:space:]]+', ' '));
--> statement-breakpoint

-- 5. De-duplicate rows that would violate the new unique constraints (keep lowest id).
DELETE w1 FROM `wishlists` w1
JOIN `wishlists` w2
  ON w1.`customer_id` = w2.`customer_id` AND w1.`product_id` = w2.`product_id` AND w1.`id` > w2.`id`;
--> statement-breakpoint
DELETE o1 FROM `offer_items` o1
JOIN `offer_items` o2
  ON o1.`offer_id` = o2.`offer_id` AND o1.`variant_id` = o2.`variant_id` AND o1.`id` > o2.`id`;
--> statement-breakpoint
DELETE v1 FROM `product_variants` v1
JOIN `product_variants` v2
  ON v1.`product_id` = v2.`product_id` AND v1.`size_label` = v2.`size_label` AND v1.`id` > v2.`id`;
--> statement-breakpoint

-- 6. Add soft-delete column for product variants, plus a generated column that
--    holds size_label only for active rows (NULL when soft-deleted) so size
--    uniqueness below ignores soft-deleted history (multiple NULLs are allowed
--    in a MySQL unique index).
ALTER TABLE `product_variants` ADD `deleted_at` datetime;
--> statement-breakpoint
ALTER TABLE `product_variants` ADD `active_size_label` varchar(64) GENERATED ALWAYS AS (CASE WHEN `deleted_at` IS NULL THEN `size_label` ELSE NULL END) STORED;
--> statement-breakpoint

-- 7. Add unique constraints.
ALTER TABLE `wishlists` ADD CONSTRAINT `wishlists_customer_product_unique` UNIQUE(`customer_id`,`product_id`);
--> statement-breakpoint
ALTER TABLE `offer_items` ADD CONSTRAINT `offer_items_offer_variant_unique` UNIQUE(`offer_id`,`variant_id`);
--> statement-breakpoint
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_active_size_unique` UNIQUE(`product_id`,`active_size_label`);
--> statement-breakpoint

-- 8. Add foreign keys.
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `offer_items` ADD CONSTRAINT `offer_items_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `offer_items` ADD CONSTRAINT `offer_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE restrict ON UPDATE no action;
