CREATE TABLE `paymob_callback_inbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_fingerprint` varchar(64) NOT NULL,
	`fingerprint_version` int NOT NULL DEFAULT 1,
	`normalized_payload` json NOT NULL,
	`hinted_transaction_id` varchar(64),
	`callback_type` enum('transaction','card_token') NOT NULL,
	`processing_status` enum('received','processing','processed','rejected','failed') NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`processed_at` datetime,
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymob_callback_inbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymob_callback_inbox_event_fingerprint_unique` UNIQUE(`event_fingerprint`)
);
--> statement-breakpoint
ALTER TABLE `shipping_work_items` MODIFY COLUMN `operation` enum('create_delivery','cancel_delivery','terminate_delivery','sync_delivery','edit_delivery') NOT NULL;--> statement-breakpoint
CREATE INDEX `paymob_callback_inbox_status_received_idx` ON `paymob_callback_inbox` (`processing_status`,`received_at`);--> statement-breakpoint
CREATE INDEX `paymob_callback_inbox_transaction_idx` ON `paymob_callback_inbox` (`hinted_transaction_id`);