CREATE TABLE `delivery_areas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`governorate_id` int NOT NULL,
	`ar_name` varchar(120) NOT NULL,
	`en_name` varchar(120) NOT NULL,
	`fee` decimal(10,3) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_areas_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_areas_governorate_ar_name_unique` UNIQUE(`governorate_id`,`ar_name`),
	CONSTRAINT `delivery_areas_governorate_en_name_unique` UNIQUE(`governorate_id`,`en_name`)
);
--> statement-breakpoint
CREATE TABLE `delivery_governorates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ar_name` varchar(120) NOT NULL,
	`en_name` varchar(120) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_governorates_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_governorates_ar_name_unique` UNIQUE(`ar_name`),
	CONSTRAINT `delivery_governorates_en_name_unique` UNIQUE(`en_name`)
);
--> statement-breakpoint
ALTER TABLE `bundle_discounts` MODIFY COLUMN `value` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `collections` MODIFY COLUMN `fixed_price` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` MODIFY COLUMN `fixed_price` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `unit_price` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `line_total` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `snapshot_base_unit_price` decimal(10,3);--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `snapshot_discount_value` decimal(10,3);--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `total_amount` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `product_variants` MODIFY COLUMN `selling_price` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `buying_price` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `variant_discounts` MODIFY COLUMN `value` decimal(10,3) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `area_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_fee` decimal(10,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `delivery_fee` decimal(10,3);--> statement-breakpoint
ALTER TABLE `delivery_areas` ADD CONSTRAINT `delivery_areas_governorate_id_delivery_governorates_id_fk` FOREIGN KEY (`governorate_id`) REFERENCES `delivery_governorates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_area_id_delivery_areas_id_fk` FOREIGN KEY (`area_id`) REFERENCES `delivery_areas`(`id`) ON DELETE set null ON UPDATE no action;