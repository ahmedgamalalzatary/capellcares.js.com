ALTER TABLE `order_items` MODIFY COLUMN `snapshot_size_label` text;--> statement-breakpoint
CREATE INDEX `orders_cod_expiry_idx` ON `orders` (`payment_method`,`payment_status`,`cod_expires_at`);