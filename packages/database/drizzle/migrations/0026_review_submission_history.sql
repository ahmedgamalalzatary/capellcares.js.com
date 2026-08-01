CREATE TABLE `review_submission_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`order_item_id` int NOT NULL,
	`entity_type` enum('product','offer','collection') NOT NULL,
	`entity_id` int NOT NULL,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_submission_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_submission_history_customer_entity_unique` UNIQUE(`customer_id`,`entity_type`,`entity_id`)
);
--> statement-breakpoint
INSERT INTO `review_submission_history` (`customer_id`,`order_item_id`,`entity_type`,`entity_id`,`submitted_at`)
SELECT `customer_id`,`order_item_id`,`entity_type`,`entity_id`,`created_at` FROM `reviews`;
--> statement-breakpoint
ALTER TABLE `review_submission_history` ADD CONSTRAINT `review_submission_history_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `review_submission_history` ADD CONSTRAINT `review_submission_history_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE restrict ON UPDATE no action;
