CREATE TABLE `review_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`entity_type` enum('product','offer','collection') NOT NULL,
	`entity_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_submissions_customer_entity_unique` UNIQUE(`customer_id`,`entity_type`,`entity_id`),
	CONSTRAINT `review_submissions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submission_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`entity_type` enum('product','offer','collection') NOT NULL,
	`entity_id` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`status` enum('pending','approved','rejected','hidden') NOT NULL DEFAULT 'pending',
	`moderated_by_admin_user_id` int,
	`moderated_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_submission_id_unique` UNIQUE(`submission_id`),
	CONSTRAINT `reviews_rating_range_check` CHECK (`rating` between 1 and 5),
	CONSTRAINT `reviews_submission_id_review_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `review_submissions`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `reviews_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `reviews_moderated_by_admin_user_id_admin_users_id_fk` FOREIGN KEY (`moderated_by_admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL
);
