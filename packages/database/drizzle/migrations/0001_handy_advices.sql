CREATE TABLE `advices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ar_title` varchar(255) NOT NULL,
	`en_title` varchar(255) NOT NULL,
	`ar_description` text NOT NULL,
	`en_description` text NOT NULL,
	`image_path` varchar(1024),
	`video_url` varchar(1024),
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `advices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders`
	ADD `order_code` varchar(32) NOT NULL,
	MODIFY COLUMN `payment_status` enum('pending','accepted','denied') NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders`
	ADD CONSTRAINT `orders_order_code_unique` UNIQUE(`order_code`);
--> statement-breakpoint
ALTER TABLE `order_items`
	ADD `created_at` timestamp NOT NULL DEFAULT (now()),
	ADD `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint
ALTER TABLE `product_variants`
	ADD CONSTRAINT `product_variants_product_id_products_id_fk`
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;
