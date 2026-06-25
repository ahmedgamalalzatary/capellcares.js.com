CREATE TABLE `variant_discounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `variant_id` int NOT NULL,
  `type` enum('percentage','fixed') NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `variant_discounts_id` PRIMARY KEY(`id`),
  CONSTRAINT `variant_discounts_variant_id_unique` UNIQUE(`variant_id`),
  CONSTRAINT `variant_discounts_value_positive` CHECK (`value` > 0),
  CONSTRAINT `variant_discounts_percentage_value_max` CHECK (`type` <> 'percentage' OR `value` <= 100),
  CONSTRAINT `variant_discounts_fixed_value_positive` CHECK (`type` <> 'fixed' OR `value` > 0),
  CONSTRAINT `variant_discounts_valid_window` CHECK (`ends_at` > `starts_at`)
);
--> statement-breakpoint
ALTER TABLE `variant_discounts` ADD CONSTRAINT `variant_discounts_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `order_items`
  ADD `snapshot_base_unit_price` decimal(10,2) NULL,
  ADD `snapshot_discount_id` int NULL,
  ADD `snapshot_discount_type` enum('percentage','fixed') NULL,
  ADD `snapshot_discount_value` decimal(10,2) NULL,
  ADD `snapshot_discount_starts_at` datetime NULL,
  ADD `snapshot_discount_ends_at` datetime NULL;
