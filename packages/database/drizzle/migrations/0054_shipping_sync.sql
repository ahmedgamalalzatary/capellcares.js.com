ALTER TABLE `shipment_events` MODIFY COLUMN `shipment_id` int;--> statement-breakpoint
ALTER TABLE `shipping_work_items` MODIFY COLUMN `operation` enum('create_delivery','cancel_delivery','terminate_delivery','sync_delivery') NOT NULL;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD `tracking_number` varchar(64);--> statement-breakpoint
ALTER TABLE `shipment_events` ADD `business_reference` varchar(64);--> statement-breakpoint
ALTER TABLE `shipment_events` ADD `provider_account_key` varchar(64);--> statement-breakpoint
ALTER TABLE `shipment_events` ADD `provider_event_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `shipment_events` ADD `processing_error` text;--> statement-breakpoint
ALTER TABLE `shipments` ADD `provider_event_at_ms` bigint;--> statement-breakpoint
ALTER TABLE `shipments` ADD `carrier_snapshot` text;--> statement-breakpoint
ALTER TABLE `shipments` ADD `collected_amount_cents` int;--> statement-breakpoint
ALTER TABLE `shipments` ADD `collection_confirmed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_work_items` ADD `shipment_id` int;--> statement-breakpoint
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_collected_amount_cents_check` CHECK (`shipments`.`collected_amount_cents` >= 0);--> statement-breakpoint
ALTER TABLE `shipping_work_items` ADD CONSTRAINT `shipping_work_items_shipment_id_shipments_id_fk` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `shipment_events_pending_idx` ON `shipment_events` (`processed_at`,`id`);