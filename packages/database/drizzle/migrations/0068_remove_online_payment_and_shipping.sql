ALTER TABLE `orders` DROP FOREIGN KEY `orders_payment_attempt_id_payment_attempts_id_fk`;
--> statement-breakpoint
SET FOREIGN_KEY_CHECKS = 0
--> statement-breakpoint
DROP TABLE `shipment_events`;
--> statement-breakpoint
DROP TABLE `shipment_provider_bindings`;
--> statement-breakpoint
DROP TABLE `shipping_work_items`;
--> statement-breakpoint
DROP TABLE `shipments`;
--> statement-breakpoint
DROP TABLE `order_review_flags`;
--> statement-breakpoint
DROP TABLE `order_state_history`;
--> statement-breakpoint
DROP TABLE `payment_webhook_events`;
--> statement-breakpoint
DROP TABLE `paymob_callback_inbox`;
--> statement-breakpoint
DROP TABLE `checkout_reservations`;
--> statement-breakpoint
DROP TABLE `shipping_checkout_quotes`;
--> statement-breakpoint
DROP TABLE `shipping_rates`;
--> statement-breakpoint
DROP TABLE `payment_attempts`;
--> statement-breakpoint
DROP TABLE `checkout_sessions`;
--> statement-breakpoint
SET FOREIGN_KEY_CHECKS = 1
--> statement-breakpoint
ALTER TABLE `orders` DROP INDEX `orders_payment_attempt_id_unique`;
--> statement-breakpoint
ALTER TABLE `orders` DROP CONSTRAINT `orders_refunded_amount_cents_check`;
--> statement-breakpoint
ALTER TABLE `orders` DROP CONSTRAINT `orders_shipping_amount_cents_check`;
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `payment_method` enum('cod') NOT NULL DEFAULT 'cod';
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `provider_payment_status`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `refunded_amount_cents`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `payment_attempt_id`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `shipping_amount_cents`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `shipping_quote_id`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `shipping_size`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `shipping_snapshot`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `manual_shipping_state`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `shipping_processing_at_ms`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `shipping_pickup_at_ms`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `shipping_address_blocked_at_ms`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `cancellation_status`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `cancellation_requested_at_ms`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `cancellation_completed_at_ms`;
--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `stock_restored_at_ms`;
