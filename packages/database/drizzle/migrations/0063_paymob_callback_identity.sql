ALTER TABLE `paymob_callback_inbox` ADD `signed_order_id` varchar(64);--> statement-breakpoint
ALTER TABLE `paymob_callback_inbox` ADD `bound_session_id` int;--> statement-breakpoint
ALTER TABLE `paymob_callback_inbox` ADD `signed_integration_id` int;--> statement-breakpoint
CREATE INDEX `paymob_callback_inbox_signed_order_idx` ON `paymob_callback_inbox` (`signed_order_id`,`processing_status`);--> statement-breakpoint
CREATE INDEX `paymob_callback_inbox_bound_session_idx` ON `paymob_callback_inbox` (`bound_session_id`,`processing_status`);