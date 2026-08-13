ALTER TABLE `entity_media` MODIFY COLUMN `url` varchar(1024);--> statement-breakpoint
ALTER TABLE `entity_media` ADD `ar_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `products` ADD `ar_hover_image_path` varchar(1024);--> statement-breakpoint
ALTER TABLE `entity_media` ADD CONSTRAINT `entity_media_localized_url_check` CHECK (((`entity_media`.`media_type` = 'image' and ((`entity_media`.`ar_url` is not null and `entity_media`.`ar_url` <> '') or (`entity_media`.`url` is not null and `entity_media`.`url` <> ''))) or (`entity_media`.`media_type` = 'video' and `entity_media`.`url` is not null and `entity_media`.`url` <> '' and `entity_media`.`ar_url` is null)));
