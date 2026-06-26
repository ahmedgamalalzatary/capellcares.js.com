CREATE TABLE `category_paths` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ancestor_id` int NOT NULL,
	`descendant_id` int NOT NULL,
	`depth` int NOT NULL,
	CONSTRAINT `category_paths_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_paths_ancestor_descendant_unique` UNIQUE(`ancestor_id`,`descendant_id`)
);
--> statement-breakpoint
ALTER TABLE `category_paths` ADD CONSTRAINT `category_paths_ancestor_id_categories_id_fk` FOREIGN KEY (`ancestor_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `category_paths` ADD CONSTRAINT `category_paths_descendant_id_categories_id_fk` FOREIGN KEY (`descendant_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;
