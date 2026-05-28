CREATE TABLE `product_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`media_type` enum('image','video') NOT NULL,
	`url` varchar(1024) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_media_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_media_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade
);
