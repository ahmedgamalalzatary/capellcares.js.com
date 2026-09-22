CREATE TABLE `bundle_discounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`offer_id` int,
	`collection_id` int,
	`type` enum('percentage','fixed') NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundle_discounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `bundle_discounts_offer_id_unique` UNIQUE(`offer_id`),
	CONSTRAINT `bundle_discounts_collection_id_unique` UNIQUE(`collection_id`)
);
--> statement-breakpoint
ALTER TABLE `bundle_discounts` ADD CONSTRAINT `bundle_discounts_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_discounts` ADD CONSTRAINT `bundle_discounts_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE cascade ON UPDATE no action;