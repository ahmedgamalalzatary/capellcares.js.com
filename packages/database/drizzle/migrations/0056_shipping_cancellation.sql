ALTER TABLE `orders` ADD `cancellation_status` enum('pending','cancelled');--> statement-breakpoint
ALTER TABLE `orders` ADD `cancellation_requested_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancellation_completed_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `orders` ADD `stock_restored_at_ms` bigint;