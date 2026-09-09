CREATE TABLE `announcement_bar_settings` (
  `id` int NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `announcement_bar_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

INSERT INTO `announcement_bar_settings` (`id`, `status`)
VALUES (1, 'active');
