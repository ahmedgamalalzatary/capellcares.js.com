ALTER TABLE `orders` ADD `idempotency_key` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `checkout_fingerprint` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `cod_expires_at` datetime;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_idempotency_key_unique` UNIQUE(`idempotency_key`);