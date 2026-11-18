CREATE TABLE `promo_code_customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promo_code_id` int NOT NULL,
	`customer_id` int NOT NULL,
	CONSTRAINT `promo_code_customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_code_customers_unique` UNIQUE(`promo_code_id`,`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `promo_code_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promo_code_id` int NOT NULL,
	`action` enum('created','paused','resumed','stopped') NOT NULL,
	`admin_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promo_code_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promo_code_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promo_code_id` int NOT NULL,
	`target_type` enum('category','product','variant','offer','collection') NOT NULL,
	`target_id` int NOT NULL,
	`mode` enum('include','exclude') NOT NULL,
	CONSTRAINT `promo_code_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_code_targets_unique` UNIQUE(`promo_code_id`,`target_type`,`target_id`,`mode`)
);
--> statement-breakpoint
CREATE TABLE `promo_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`code_normalized` varchar(64) NOT NULL,
	`ar_name` varchar(255) NOT NULL,
	`en_name` varchar(255) NOT NULL,
	`status` enum('active','paused','stopped') NOT NULL DEFAULT 'active',
	`starts_at` datetime NOT NULL,
	`ends_at` datetime,
	`discount_type` enum('percentage','fixed'),
	`discount_value` decimal(10,2),
	`max_discount_amount` decimal(10,2),
	`free_shipping` boolean NOT NULL DEFAULT false,
	`gift_item_type` enum('product_variant','offer','collection'),
	`gift_item_id` int,
	`gift_qty` int,
	`eligibility_scope` enum('all','selected') NOT NULL DEFAULT 'all',
	`min_order_amount` decimal(10,2),
	`max_order_amount` decimal(10,2),
	`min_eligible_pieces` int,
	`max_discounted_pieces` int,
	`total_usage_limit` int,
	`per_customer_limit` int,
	`first_order_only` boolean NOT NULL DEFAULT false,
	`is_private` boolean NOT NULL DEFAULT false,
	`show_in_account` boolean NOT NULL DEFAULT false,
	`created_by_admin_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_codes_code_normalized_unique` UNIQUE(`code_normalized`)
);
--> statement-breakpoint
CREATE TABLE `promo_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promo_code_id` int NOT NULL,
	`customer_id` int,
	`phone_normalized` varchar(32),
	`checkout_session_id` int,
	`order_id` int,
	`state` enum('reserved','used','released') NOT NULL,
	`release_reason` enum('payment_failed','session_expired','early_refund','cancelled','denied','expired'),
	`over_limit` boolean NOT NULL DEFAULT false,
	`discount_cents` int NOT NULL DEFAULT 0,
	`shipping_waived_cents` int NOT NULL DEFAULT 0,
	`gift_value_cents` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD `promo_code_id` int;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD `promo_code_text` varchar(64);--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD `promo_snapshot` text;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD `promo_discount_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD `promo_shipping_waived_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `promo_discount_amount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `order_items` ADD `promo_replaced_discount_id` int;--> statement-breakpoint
ALTER TABLE `order_items` ADD `is_promo_gift` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `promo_code_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `promo_code_text` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `promo_snapshot` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `promo_discount_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `promo_shipping_waived_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `promo_code_customers` ADD CONSTRAINT `promo_code_customers_promo_code_id_promo_codes_id_fk` FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_code_customers` ADD CONSTRAINT `promo_code_customers_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_code_events` ADD CONSTRAINT `promo_code_events_promo_code_id_promo_codes_id_fk` FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_code_events` ADD CONSTRAINT `promo_code_events_admin_user_id_admin_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_code_targets` ADD CONSTRAINT `promo_code_targets_promo_code_id_promo_codes_id_fk` FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_codes` ADD CONSTRAINT `promo_codes_created_by_admin_id_admin_users_id_fk` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_redemptions` ADD CONSTRAINT `promo_redemptions_promo_code_id_promo_codes_id_fk` FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_redemptions` ADD CONSTRAINT `promo_redemptions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_redemptions` ADD CONSTRAINT `promo_redemptions_checkout_session_id_checkout_sessions_id_fk` FOREIGN KEY (`checkout_session_id`) REFERENCES `checkout_sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promo_redemptions` ADD CONSTRAINT `promo_redemptions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `promo_code_events_code_idx` ON `promo_code_events` (`promo_code_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `promo_codes_status_idx` ON `promo_codes` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `promo_redemptions_code_state_idx` ON `promo_redemptions` (`promo_code_id`,`state`);--> statement-breakpoint
CREATE INDEX `promo_redemptions_code_customer_idx` ON `promo_redemptions` (`promo_code_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `promo_redemptions_code_phone_idx` ON `promo_redemptions` (`promo_code_id`,`phone_normalized`);