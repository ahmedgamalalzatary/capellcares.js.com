CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`order_item_id` int NOT NULL,
	`entity_type` enum('product','offer','collection') NOT NULL,
	`entity_id` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_customer_entity_unique` UNIQUE(`customer_id`,`entity_type`,`entity_id`),
	CONSTRAINT `reviews_rating_check` CHECK (`rating` between 1 and 5),
	CONSTRAINT `reviews_comment_length_check` CHECK (char_length(trim(`comment`)) between 3 and 1000)
);
--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `reviews_public_target_idx` ON `reviews` (`entity_type`,`entity_id`,`status`,`deleted_at`,`created_at`);
