CREATE TABLE `product_colors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`ar_name` varchar(255) NOT NULL DEFAULT '',
	`en_name` varchar(255) NOT NULL DEFAULT '',
	`hex` varchar(7),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_colors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `product_variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
ALTER TABLE `product_variants` DROP INDEX `product_variants_active_size_unique`;--> statement-breakpoint
ALTER TABLE `entity_media` ADD `product_color_id` int;--> statement-breakpoint
ALTER TABLE `order_items` ADD `snapshot_color_ar` varchar(255);--> statement-breakpoint
ALTER TABLE `order_items` ADD `snapshot_color_en` varchar(255);--> statement-breakpoint
ALTER TABLE `product_colors` ADD CONSTRAINT `product_colors_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `product_colors_product_idx` ON `product_colors` (`product_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `entity_media` ADD CONSTRAINT `entity_media_product_color_id_product_colors_id_fk` FOREIGN KEY (`product_color_id`) REFERENCES `product_colors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variants` DROP COLUMN `active_size_label`;