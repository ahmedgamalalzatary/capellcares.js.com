ALTER TABLE `shop_media_section_items`
  ADD COLUMN `mobile_image_path` varchar(1024);
--> statement-breakpoint

UPDATE `shop_media_section_items`
SET `mobile_image_path` = `image_path`
WHERE `mobile_image_path` IS NULL OR `mobile_image_path` = '';
--> statement-breakpoint

ALTER TABLE `shop_media_section_items`
  MODIFY COLUMN `mobile_image_path` varchar(1024) NOT NULL;
