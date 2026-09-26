CREATE TABLE `order_review_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`flag_type` enum('address_review','expiry_review','refund_review','amount_mismatch','custody_review','cancellation_pending') NOT NULL,
	`reason` text NOT NULL,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` datetime,
	CONSTRAINT `order_review_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_state_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`state` enum('preparing','ready_for_pickup','printed','delivered','returned') NOT NULL,
	`actor_type` enum('staff','system') NOT NULL,
	`actor_id` int,
	`reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_state_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipment_id` int NOT NULL,
	`event_fingerprint` varchar(128) NOT NULL,
	`raw_payload` text NOT NULL,
	`raw_provider_state` varchar(64),
	`raw_provider_code` int,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`processed_at` datetime,
	CONSTRAINT `shipment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipment_events_fingerprint_unique` UNIQUE(`event_fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`kind` enum('outgoing','return','exchange') NOT NULL,
	`provider` enum('bosta') NOT NULL,
	`tracking_number` varchar(64) NOT NULL,
	`raw_provider_state` varchar(64) NOT NULL,
	`raw_provider_code` int,
	`normalized_state` enum('created','picked_up','in_transit','delivered','returned','cancelled','exception') NOT NULL,
	`manual_state` enum('preparing','ready_for_pickup','printed','delivered','returned'),
	`shipping_amount_cents` int NOT NULL DEFAULT 0,
	`size` enum('small','medium','large') NOT NULL,
	`idempotency_key` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipments_tracking_number_unique` UNIQUE(`tracking_number`),
	CONSTRAINT `shipments_idempotency_key_unique` UNIQUE(`idempotency_key`),
	CONSTRAINT `shipments_shipping_amount_cents_check` CHECK(`shipments`.`shipping_amount_cents` >= 0)
);
--> statement-breakpoint
CREATE TABLE `shipping_work_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`operation` enum('create_delivery','cancel_delivery','terminate_delivery') NOT NULL,
	`idempotency_key` varchar(64) NOT NULL,
	`status` enum('pending','processing','succeeded','failed','review_required') NOT NULL,
	`attempt_count` int NOT NULL DEFAULT 0,
	`next_attempt_at` datetime NOT NULL,
	`claimed_by` varchar(64),
	`claimed_at` datetime,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_work_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipping_work_items_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
ALTER TABLE `checkout_sessions` DROP CONSTRAINT `checkout_sessions_shipping_check`;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_amount_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_quote_id` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_size` enum('small','medium','large');--> statement-breakpoint
ALTER TABLE `order_review_flags` ADD CONSTRAINT `order_review_flags_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_state_history` ADD CONSTRAINT `order_state_history_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_state_history` ADD CONSTRAINT `order_state_history_actor_id_admin_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD CONSTRAINT `shipment_events_shipment_id_shipments_id_fk` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipping_work_items` ADD CONSTRAINT `shipping_work_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_review_flags_order_idx` ON `order_review_flags` (`order_id`,`status`);--> statement-breakpoint
CREATE INDEX `order_state_history_order_idx` ON `order_state_history` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shipment_events_shipment_idx` ON `shipment_events` (`shipment_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `shipments_order_idx` ON `shipments` (`order_id`,`kind`);--> statement-breakpoint
CREATE INDEX `shipping_work_items_status_idx` ON `shipping_work_items` (`status`,`next_attempt_at`);--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_shipping_check` CHECK (`checkout_sessions`.`shipping_amount_cents` >= 0);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_shipping_amount_cents_check` CHECK (`orders`.`shipping_amount_cents` >= 0);