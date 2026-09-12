ALTER TABLE `orders` MODIFY COLUMN `payment_method` enum('cod','paymob') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `provider_payment_status` enum('pending','succeeded','failed','partially_refunded','refunded','voided');--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_attempt_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_payment_attempt_id_unique` UNIQUE(`payment_attempt_id`);