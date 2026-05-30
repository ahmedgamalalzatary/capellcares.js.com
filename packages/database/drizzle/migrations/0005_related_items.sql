CREATE TABLE `related_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_type` enum('product','offer','collection') NOT NULL,
	`source_id` int NOT NULL,
	`target_type` enum('product','offer','collection') NOT NULL,
	`target_id` int NOT NULL,
	`rank` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `related_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `related_items_link_unique` UNIQUE(`source_type`,`source_id`,`target_type`,`target_id`)
);
