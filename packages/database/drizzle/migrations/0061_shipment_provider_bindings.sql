CREATE TABLE `shipment_provider_bindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipment_id` int NOT NULL,
	`order_id` int NOT NULL,
	`provider` enum('bosta') NOT NULL DEFAULT 'bosta',
	`account_id` varchar(128) NOT NULL,
	`account_key` varchar(64) NOT NULL,
	`environment` enum('test','live') NOT NULL,
	`provider_reference` varchar(128),
	`provider_tracking_id` varchar(64) NOT NULL,
	`original_shipment_id` int,
	`relation_kind` enum('outgoing','related') NOT NULL,
	`business_reference` varchar(64),
	`proof` text,
	`proof_version` varchar(32),
	`verified_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipment_provider_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipment_provider_bindings_shipment_unique` UNIQUE(`shipment_id`),
	CONSTRAINT `shipment_provider_bindings_account_tracking_unique` UNIQUE(`account_id`,`environment`,`provider_tracking_id`)
);
--> statement-breakpoint
ALTER TABLE `shipment_provider_bindings` ADD CONSTRAINT `shipment_provider_bindings_shipment_id_shipments_id_fk` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_provider_bindings` ADD CONSTRAINT `shipment_provider_bindings_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_provider_bindings` ADD CONSTRAINT `shipment_provider_bindings_original_shipment_id_shipments_id_fk` FOREIGN KEY (`original_shipment_id`) REFERENCES `shipments`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `shipment_provider_bindings_order_idx` ON `shipment_provider_bindings` (`order_id`,`relation_kind`);--> statement-breakpoint
CREATE INDEX `shipment_provider_bindings_original_idx` ON `shipment_provider_bindings` (`original_shipment_id`);