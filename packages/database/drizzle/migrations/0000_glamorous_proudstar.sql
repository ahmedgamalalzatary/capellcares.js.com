CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parent_id` int,
	`slug` varchar(191) NOT NULL,
	`ar_name` varchar(255) NOT NULL,
	`en_name` varchar(255) NOT NULL,
	`is_leaf` boolean NOT NULL DEFAULT false,
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `offer_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`offer_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`qty` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `offer_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(191) NOT NULL,
	`ar_name` varchar(255) NOT NULL,
	`en_name` varchar(255) NOT NULL,
	`ar_description` text,
	`en_description` text,
	`image_path` varchar(1024),
	`fixed_price` decimal(10,2) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`visibility` enum('visible','hidden') NOT NULL DEFAULT 'visible',
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`),
	CONSTRAINT `offers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`item_type` enum('product_variant','offer') NOT NULL,
	`variant_id` int,
	`offer_id` int,
	`qty` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`line_total` decimal(10,2) NOT NULL,
	`snapshot_name_ar` varchar(255),
	`snapshot_name_en` varchar(255),
	`snapshot_size_label` varchar(64),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_type` enum('guest','registered') NOT NULL,
	`customer_id` int,
	`full_name` varchar(255) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`email` varchar(255) NOT NULL,
	`governorate` varchar(120) NOT NULL,
	`city_area` varchar(120) NOT NULL,
	`address_line` varchar(255) NOT NULL,
	`building_apartment` varchar(255) NOT NULL,
	`notes` text,
	`payment_method` enum('cod') NOT NULL,
	`payment_status` enum('pending','paid','failed') NOT NULL,
	`total_amount` decimal(10,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`size_label` varchar(64) NOT NULL,
	`selling_price` decimal(10,2) NOT NULL,
	`stock_qty` int NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(128) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`ar_name` varchar(255) NOT NULL,
	`en_name` varchar(255) NOT NULL,
	`buying_price` decimal(10,2) NOT NULL,
	`keywords` text NOT NULL,
	`ar_description` text,
	`en_description` text,
	`ar_ingredients` text,
	`en_ingredients` text,
	`ar_how_to_use` text,
	`en_how_to_use` text,
	`ar_warnings` text,
	`en_warnings` text,
	`youtube_url` varchar(1024),
	`image_path` varchar(1024),
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`is_new` boolean NOT NULL DEFAULT false,
	`is_bestseller` boolean NOT NULL DEFAULT false,
	`category_id` int NOT NULL,
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`product_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlists_id` PRIMARY KEY(`id`)
);
