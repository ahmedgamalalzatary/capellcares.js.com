CREATE TABLE `category_paths` (
	`ancestor_id` int NOT NULL,
	`descendant_id` int NOT NULL,
	`depth` int NOT NULL,
	CONSTRAINT `category_paths_ancestor_descendant_unique` UNIQUE(`ancestor_id`,`descendant_id`)
);
--> statement-breakpoint
ALTER TABLE `category_paths` ADD CONSTRAINT `category_paths_ancestor_id_categories_id_fk` FOREIGN KEY (`ancestor_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `category_paths` ADD CONSTRAINT `category_paths_descendant_id_categories_id_fk` FOREIGN KEY (`descendant_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `category_paths` (`ancestor_id`, `descendant_id`, `depth`)
WITH RECURSIVE `category_tree` AS (
	SELECT `id` AS `ancestor_id`, `id` AS `descendant_id`, 0 AS `depth`, `parent_id`
	FROM `categories`
	UNION ALL
	SELECT `categories`.`id` AS `ancestor_id`, `category_tree`.`descendant_id`, `category_tree`.`depth` + 1 AS `depth`, `categories`.`parent_id`
	FROM `category_tree`
	INNER JOIN `categories` ON `categories`.`id` = `category_tree`.`parent_id`
)
SELECT `ancestor_id`, `descendant_id`, `depth`
FROM `category_tree`;
