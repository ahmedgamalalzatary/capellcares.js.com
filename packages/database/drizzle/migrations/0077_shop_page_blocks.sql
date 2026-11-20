CREATE TABLE `shop_page_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('genders','category_tiles','bestsellers','new','offers','brands','collections','category','media') NOT NULL,
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
SELECT 'media', CONCAT('media:', `id`), NULL, `id`, 1
FROM `shop_media_sections`
WHERE `slot` = 1 AND EXISTS (SELECT 1 FROM `shop_media_section_items` WHERE `shop_media_section_items`.`section_id` = `shop_media_sections`.`id`)
UNION ALL SELECT 'genders', 'genders', NULL, NULL, 2
UNION ALL SELECT 'category_tiles', 'category_tiles', NULL, NULL, 3
UNION ALL SELECT 'bestsellers', 'bestsellers', NULL, NULL, 4
UNION ALL SELECT `type`, CONCAT(`type`, ':', COALESCE(`category_id`, `media_section_id`)), `category_id`, `media_section_id`, 4 + ROW_NUMBER() OVER (ORDER BY `sort_order`, `id`)
FROM `shop_custom_blocks`
UNION ALL SELECT 'new', 'new', NULL, NULL, (SELECT COUNT(*) FROM `shop_custom_blocks`) + 5
UNION ALL SELECT 'offers', 'offers', NULL, NULL, (SELECT COUNT(*) FROM `shop_custom_blocks`) + 6
UNION ALL SELECT 'brands', 'brands', NULL, NULL, (SELECT COUNT(*) FROM `shop_custom_blocks`) + 7;--> statement-breakpoint
DELETE FROM `shop_media_sections` WHERE `slot` = 1 AND NOT EXISTS (SELECT 1 FROM `shop_media_section_items` WHERE `shop_media_section_items`.`section_id` = `shop_media_sections`.`id`);--> statement-breakpoint
ALTER TABLE `shop_media_sections` DROP INDEX `shop_media_sections_slot_unique`;--> statement-breakpoint
ALTER TABLE `shop_media_sections` DROP COLUMN `slot`;
