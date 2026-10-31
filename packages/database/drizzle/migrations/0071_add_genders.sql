CREATE TABLE `genders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(191) NOT NULL,
	`ar_name` varchar(255) NOT NULL,
	`en_name` varchar(255) NOT NULL,
	`image_path` varchar(1024),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `genders_id` PRIMARY KEY(`id`),
	CONSTRAINT `genders_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_genders` (
	`product_id` int NOT NULL,
	`gender_id` int NOT NULL,
	CONSTRAINT `product_genders_unique` UNIQUE(`product_id`,`gender_id`)
);
--> statement-breakpoint
ALTER TABLE `product_genders` ADD CONSTRAINT `product_genders_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_genders` ADD CONSTRAINT `product_genders_gender_id_genders_id_fk` FOREIGN KEY (`gender_id`) REFERENCES `genders`(`id`) ON DELETE restrict ON UPDATE no action;