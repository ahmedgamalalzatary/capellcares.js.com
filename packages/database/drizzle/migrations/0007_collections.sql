CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(191) NOT NULL,
	`ar_name` varchar(255) NOT NULL,
	`en_name` varchar(255) NOT NULL,
	`ar_description` text,
	`en_description` text,
	`image_path` varchar(1024),
	`fixed_price` decimal(10,2) NOT NULL,
	`category_id` int NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`visibility` enum('visible','hidden') NOT NULL DEFAULT 'visible',
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collection_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`qty` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `collection_items_collection_variant_unique` UNIQUE(`collection_id`,`variant_id`)
);
--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `item_type` enum('product_variant','offer','collection') NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_items` ADD `collection_id` int;
--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `collection_items` ADD CONSTRAINT `collection_items_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `collection_items` ADD CONSTRAINT `collection_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE restrict ON UPDATE no action;
