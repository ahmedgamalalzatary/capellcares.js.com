ALTER TABLE `payment_attempts` ADD `reconcile_attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `reconcile_next_at` datetime;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `reconcile_claimed_at` datetime;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `reconcile_claimed_by` varchar(64);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `reconcile_last_error` varchar(128);--> statement-breakpoint
CREATE INDEX `payment_attempts_reconcile_idx` ON `payment_attempts` (`status`,`reconcile_next_at`);