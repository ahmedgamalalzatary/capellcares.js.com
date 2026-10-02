ALTER TABLE `paymob_callback_inbox` MODIFY COLUMN `processing_status` enum('received','processing','processed','rejected','failed','review_required') NOT NULL;--> statement-breakpoint
ALTER TABLE `paymob_callback_inbox` ADD `claimed_by` varchar(36);--> statement-breakpoint
ALTER TABLE `paymob_callback_inbox` ADD `claimed_at` datetime(3);--> statement-breakpoint
ALTER TABLE `paymob_callback_inbox` ADD `next_attempt_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL;--> statement-breakpoint
CREATE INDEX `paymob_callback_inbox_due_idx` ON `paymob_callback_inbox` (`processing_status`,`next_attempt_at`,`id`);