ALTER TABLE `admin_users` MODIFY COLUMN `role` enum('admin','staff') NOT NULL DEFAULT 'admin';
--> statement-breakpoint
ALTER TABLE `admin_users` ADD `is_active` boolean NOT NULL DEFAULT true;
