CREATE TABLE `product_sizes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `size_label` varchar(64) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `deleted_at` datetime,
  `active_size_label` varchar(64) GENERATED ALWAYS AS (
    CASE WHEN `deleted_at` IS NULL THEN `size_label` ELSE NULL END
  ) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `product_sizes_id` PRIMARY KEY (`id`),
  CONSTRAINT `product_sizes_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_sizes_id_product_unique` UNIQUE (`id`, `product_id`),
  CONSTRAINT `product_sizes_active_label_unique` UNIQUE (`product_id`, `active_size_label`)
);
--> statement-breakpoint
CREATE TABLE `product_colors` (
  `id` int AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `color_hex` varchar(7) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `deleted_at` datetime,
  `active_color_hex` varchar(7) GENERATED ALWAYS AS (
    CASE WHEN `deleted_at` IS NULL THEN `color_hex` ELSE NULL END
  ) STORED,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `product_colors_id` PRIMARY KEY (`id`),
  CONSTRAINT `product_colors_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_colors_id_product_unique` UNIQUE (`id`, `product_id`),
  CONSTRAINT `product_colors_active_hex_unique` UNIQUE (`product_id`, `active_color_hex`),
  CONSTRAINT `product_colors_canonical_hex_check` CHECK (`color_hex` REGEXP '^#[0-9A-F]{6}$')
);
