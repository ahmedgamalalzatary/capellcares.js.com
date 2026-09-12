CREATE TABLE `checkout_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkout_session_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`qty` int NOT NULL,
	`state` enum('reserved','released','finalized') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkout_reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `checkout_reservations_session_variant_unique` UNIQUE(`checkout_session_id`,`variant_id`),
	CONSTRAINT `checkout_reservations_qty_check` CHECK(`checkout_reservations`.`qty` > 0)
);
--> statement-breakpoint
CREATE TABLE `checkout_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`idempotency_key` varchar(64) NOT NULL,
	`customer_type` enum('guest','registered') NOT NULL,
	`customer_id` int,
	`full_name` varchar(255) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`email` varchar(255) NOT NULL,
	`governorate` varchar(120) NOT NULL,
	`city_area` varchar(120) NOT NULL,
	`address_line` varchar(255) NOT NULL,
	`building_apartment` varchar(255) NOT NULL,
	`notes` text,
	`cart_snapshot` text NOT NULL,
	`amount_cents` int NOT NULL,
	`shipping_amount_cents` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'EGP',
	`state` enum('open','payment_pending','completed','failed','expired') NOT NULL,
	`attempt_count` int NOT NULL DEFAULT 0,
	`reservation_expires_at` datetime NOT NULL,
	`created_order_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checkout_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `checkout_sessions_public_id_unique` UNIQUE(`public_id`),
	CONSTRAINT `checkout_sessions_idempotency_key_unique` UNIQUE(`idempotency_key`),
	CONSTRAINT `checkout_sessions_amount_check` CHECK(`checkout_sessions`.`amount_cents` > 0),
	CONSTRAINT `checkout_sessions_shipping_check` CHECK(`checkout_sessions`.`shipping_amount_cents` = 0),
	CONSTRAINT `checkout_sessions_attempt_count_check` CHECK(`checkout_sessions`.`attempt_count` between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE `payment_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkout_session_id` int NOT NULL,
	`attempt_number` int NOT NULL,
	`merchant_reference` varchar(191) NOT NULL,
	`amount_cents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EGP',
	`environment` enum('test','live') NOT NULL,
	`status` enum('created','pending','succeeded','failed','cancelled','expired') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_attempts_merchant_reference_unique` UNIQUE(`merchant_reference`),
	CONSTRAINT `payment_attempts_session_attempt_unique` UNIQUE(`checkout_session_id`,`attempt_number`),
	CONSTRAINT `payment_attempts_attempt_number_check` CHECK(`payment_attempts`.`attempt_number` between 1 and 3),
	CONSTRAINT `payment_attempts_amount_check` CHECK(`payment_attempts`.`amount_cents` > 0)
);
--> statement-breakpoint
ALTER TABLE `checkout_reservations` ADD CONSTRAINT `checkout_reservations_session_fk` FOREIGN KEY (`checkout_session_id`) REFERENCES `checkout_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_reservations` ADD CONSTRAINT `checkout_reservations_variant_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD CONSTRAINT `checkout_sessions_order_fk` FOREIGN KEY (`created_order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_session_fk` FOREIGN KEY (`checkout_session_id`) REFERENCES `checkout_sessions`(`id`) ON DELETE cascade ON UPDATE no action;
