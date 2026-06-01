CREATE TABLE `permissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `key` varchar(191) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
  CONSTRAINT `permissions_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `admin_user_permissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `admin_user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `admin_user_permissions_id` PRIMARY KEY(`id`),
  CONSTRAINT `admin_user_permissions_unique` UNIQUE(`admin_user_id`,`permission_id`),
  CONSTRAINT `admin_user_permissions_admin_user_id_admin_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE cascade ON UPDATE no action,
  CONSTRAINT `admin_user_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE cascade ON UPDATE no action
);
