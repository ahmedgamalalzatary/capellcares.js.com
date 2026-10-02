ALTER TABLE `shipping_work_items` ADD `sync_phase` enum('active','terminal_followup','parked') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_work_items` ADD `terminal_follow_up_at` datetime;--> statement-breakpoint
CREATE INDEX `shipping_work_items_sync_phase_idx` ON `shipping_work_items` (`operation`,`sync_phase`,`next_attempt_at`);