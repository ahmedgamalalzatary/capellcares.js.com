CREATE TABLE `shipping_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rate_key` varchar(191) NOT NULL,
	`amount_cents` int NOT NULL,
	`size` enum('small','medium','large') NOT NULL,
	`destination_id` varchar(64) NOT NULL,
	`service_type` varchar(32) NOT NULL DEFAULT 'delivery',
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_rates_rate_key_unique` UNIQUE(`rate_key`),
	CONSTRAINT `shipping_rates_amount_cents_check` CHECK(`shipping_rates`.`amount_cents` >= 0)
);
--> statement-breakpoint
CREATE INDEX `shipping_rates_lookup_idx` ON `shipping_rates` (`destination_id`,`size`,`service_type`);