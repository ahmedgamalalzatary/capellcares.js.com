ALTER TABLE `order_state_history` ADD `event_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `orders` ADD `manual_shipping_state` enum('preparing','ready_for_pickup','printed','delivered','returned');--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_processing_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_pickup_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_address_blocked_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD `state_recorded_at` datetime;--> statement-breakpoint
ALTER TABLE `shipments` ADD `raw_provider_type` varchar(64);--> statement-breakpoint
ALTER TABLE `shipments` ADD `custody_state` enum('unknown','carrier','recipient','warehouse_uninspected') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
CREATE INDEX `shipment_events_state_replay_idx` ON `shipment_events` (`state_recorded_at`,`id`);