CREATE TABLE `entity_orderings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope_type` enum('root','category','offer','collection') NOT NULL,
	`scope_id` int,
	`scope_scope_id` int GENERATED ALWAYS AS (coalesce(`scope_id`, 0)) STORED,
	`entity_type` enum('category','product','offer','collection') NOT NULL,
	`entity_id` int NOT NULL,
	`rank` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_orderings_id` PRIMARY KEY(`id`),
	CONSTRAINT `entity_orderings_scope_entity_unique` UNIQUE(`scope_type`,`scope_scope_id`,`entity_type`,`entity_id`),
	CONSTRAINT `entity_orderings_scope_rank_unique` UNIQUE(`scope_type`,`scope_scope_id`,`entity_type`,`rank`)
);
--> statement-breakpoint
INSERT INTO `entity_orderings` (`scope_type`, `scope_id`, `entity_type`, `entity_id`, `rank`)
SELECT
	CASE
		WHEN `parent_id` IS NULL THEN 'root'
		ELSE 'category'
	END AS `scope_type`,
	`parent_id` AS `scope_id`,
	'category' AS `entity_type`,
	`id` AS `entity_id`,
	`sort_order` AS `rank`
FROM `categories`
WHERE `sort_order` > 0;
