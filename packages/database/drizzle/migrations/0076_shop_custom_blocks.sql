CREATE TABLE `shop_custom_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('category','media') NOT NULL,
	`category_id` int,
	`media_section_id` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_custom_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_custom_blocks_category_id_unique` UNIQUE(`category_id`),
	CONSTRAINT `shop_custom_blocks_media_section_id_unique` UNIQUE(`media_section_id`)
);
--> statement-breakpoint
ALTER TABLE `shop_media_sections` MODIFY COLUMN `slot` int;--> statement-breakpoint
ALTER TABLE `shop_custom_blocks` ADD CONSTRAINT `shop_custom_blocks_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_custom_blocks` ADD CONSTRAINT `shop_custom_blocks_media_section_id_shop_media_sections_id_fk` FOREIGN KEY (`media_section_id`) REFERENCES `shop_media_sections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO `shop_custom_blocks` (`type`, `media_section_id`, `sort_order`) SELECT 'media', `id`, `slot` FROM `shop_media_sections` WHERE `slot` IN (2, 3, 4, 5) AND EXISTS (SELECT 1 FROM `shop_media_section_items` WHERE `shop_media_section_items`.`section_id` = `shop_media_sections`.`id`);--> statement-breakpoint
DELETE FROM `shop_media_sections` WHERE `slot` IN (2, 3, 4, 5) AND NOT EXISTS (SELECT 1 FROM `shop_media_section_items` WHERE `shop_media_section_items`.`section_id` = `shop_media_sections`.`id`);--> statement-breakpoint
UPDATE `shop_media_sections` SET `slot` = NULL WHERE `slot` IN (2, 3, 4, 5);