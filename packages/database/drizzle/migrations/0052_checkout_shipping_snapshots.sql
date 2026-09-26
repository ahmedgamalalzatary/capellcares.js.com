CREATE TABLE `shipping_checkout_quotes` (
	`quote_id` varchar(64) NOT NULL,
	`checkout_fingerprint` varchar(64) NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipping_checkout_quotes_quote_id` PRIMARY KEY(`quote_id`)
);
--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD `shipping_snapshot` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_snapshot` text;