CREATE TABLE `review_prompt_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`order_item_id` int NOT NULL,
	`entity_type` enum('product','offer','collection') NOT NULL,
	`entity_id` int NOT NULL,
	`shown_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_prompt_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_prompt_states_customer_entity_unique` UNIQUE(`customer_id`,`entity_type`,`entity_id`)
);
--> statement-breakpoint
ALTER TABLE `review_prompt_states` ADD CONSTRAINT `review_prompt_states_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `review_prompt_states` ADD CONSTRAINT `review_prompt_states_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `review_prompt_states_customer_shown_idx` ON `review_prompt_states` (`customer_id`,`shown_at`);
