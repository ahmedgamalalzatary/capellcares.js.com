ALTER TABLE `payment_attempts` ADD `paymob_intention_id` varchar(64);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `paymob_order_id` varchar(64);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `paymob_transaction_id` varchar(64);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `client_secret` varchar(512);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `integration_id` int;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `payment_method` enum('card','wallet');--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `expires_at` datetime;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD `failure_code` varchar(128);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_paymob_intention_id_unique` UNIQUE(`paymob_intention_id`);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_paymob_order_id_unique` UNIQUE(`paymob_order_id`);--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_paymob_transaction_id_unique` UNIQUE(`paymob_transaction_id`);