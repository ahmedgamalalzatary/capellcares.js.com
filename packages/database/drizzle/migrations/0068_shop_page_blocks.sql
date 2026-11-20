CREATE TABLE `shop_page_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('category_tiles','offers','collections','bestsellers','new','category','media') NOT NULL,
	`block_key` varchar(40) NOT NULL,
	`category_id` int,
	`media_section_id` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_page_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_page_blocks_block_key_unique` UNIQUE(`block_key`)
);
--> statement-breakpoint
ALTER TABLE `shop_page_blocks` ADD CONSTRAINT `shop_page_blocks_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_page_blocks` ADD CONSTRAINT `shop_page_blocks_media_section_id_shop_media_sections_id_fk` FOREIGN KEY (`media_section_id`) REFERENCES `shop_media_sections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO `shop_page_blocks` (`type`, `block_key`, `category_id`, `media_section_id`, `sort_order`)
SELECT 'media', CONCAT('media:', `id`), NULL, `id`, CASE `slot` WHEN 1 THEN 1 WHEN 2 THEN 4 WHEN 3 THEN 6 WHEN 4 THEN 8 WHEN 5 THEN 10 END
FROM `shop_media_sections`
WHERE `slot` IN (1, 2, 3, 4, 5) AND EXISTS (SELECT 1 FROM `shop_media_section_items` WHERE `shop_media_section_items`.`section_id` = `shop_media_sections`.`id`)
UNION ALL SELECT 'category_tiles', 'category_tiles', NULL, NULL, 2
UNION ALL SELECT 'offers', 'offers', NULL, NULL, 3
UNION ALL SELECT 'collections', 'collections', NULL, NULL, 5
UNION ALL SELECT 'bestsellers', 'bestsellers', NULL, NULL, 7
UNION ALL SELECT 'new', 'new', NULL, NULL, 9;--> statement-breakpoint
DELETE FROM `shop_media_sections` WHERE NOT EXISTS (SELECT 1 FROM `shop_media_section_items` WHERE `shop_media_section_items`.`section_id` = `shop_media_sections`.`id`);--> statement-breakpoint
ALTER TABLE `shop_media_sections` DROP INDEX `shop_media_sections_slot_unique`;--> statement-breakpoint
ALTER TABLE `shop_media_sections` DROP COLUMN `slot`;
