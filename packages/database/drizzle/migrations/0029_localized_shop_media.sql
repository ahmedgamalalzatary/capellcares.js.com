ALTER TABLE `shop_media_section_items`
  ADD COLUMN `ar_image_path` varchar(1024) NULL AFTER `section_id`,
  ADD COLUMN `ar_mobile_image_path` varchar(1024) NULL AFTER `ar_image_path`,
  ADD COLUMN `en_image_path` varchar(1024) NULL AFTER `ar_mobile_image_path`,
  ADD COLUMN `en_mobile_image_path` varchar(1024) NULL AFTER `en_image_path`;
--> statement-breakpoint

UPDATE `shop_media_section_items`
SET
  `en_image_path` = `image_path`,
  `en_mobile_image_path` = `mobile_image_path`;
--> statement-breakpoint

ALTER TABLE `shop_media_section_items`
  DROP COLUMN `image_path`,
  DROP COLUMN `mobile_image_path`;
