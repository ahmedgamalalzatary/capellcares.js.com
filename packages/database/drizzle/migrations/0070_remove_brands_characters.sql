ALTER TABLE `products` DROP FOREIGN KEY `products_brand_id_brands_id_fk`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `brand_id`;--> statement-breakpoint
DROP TABLE `product_characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
DROP TABLE `brands`;--> statement-breakpoint
ALTER TABLE `age_groups` ADD `image_path` varchar(1024);
