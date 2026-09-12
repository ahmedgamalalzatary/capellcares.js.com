CREATE TABLE `payment_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('paymob') NOT NULL,
	`callback_type` enum('transaction','card_token') NOT NULL,
	`event_fingerprint` varchar(128) NOT NULL,
	`processing_status` enum('received','processed','rejected','failed') NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`processed_at` datetime,
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_webhook_events_event_fingerprint_unique` UNIQUE(`event_fingerprint`)
);
