RENAME TABLE `product_media` TO `entity_media`;
--> statement-breakpoint
ALTER TABLE `entity_media` DROP FOREIGN KEY `product_media_product_id_products_id_fk`;
--> statement-breakpoint
ALTER TABLE `entity_media` MODIFY COLUMN `product_id` int NULL;
--> statement-breakpoint
ALTER TABLE `entity_media` ADD `offer_id` int NULL AFTER `product_id`;
--> statement-breakpoint
ALTER TABLE `entity_media` ADD `collection_id` int NULL AFTER `offer_id`;
--> statement-breakpoint
ALTER TABLE `entity_media` ADD CONSTRAINT `entity_media_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `entity_media` ADD CONSTRAINT `entity_media_offer_id_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `entity_media` ADD CONSTRAINT `entity_media_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `entity_media_product_idx` ON `entity_media` (`product_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `entity_media_offer_idx` ON `entity_media` (`offer_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `entity_media_collection_idx` ON `entity_media` (`collection_id`,`sort_order`);
--> statement-breakpoint
INSERT INTO `entity_media` (`offer_id`,`media_type`,`url`,`sort_order`)
SELECT `id`, 'image', `image_path`, 1
FROM `offers`
WHERE `image_path` IS NOT NULL AND TRIM(`image_path`) <> '';
--> statement-breakpoint
INSERT INTO `entity_media` (`collection_id`,`media_type`,`url`,`sort_order`)
SELECT `id`, 'image', `image_path`, 1
FROM `collections`
WHERE `image_path` IS NOT NULL AND TRIM(`image_path`) <> '';
--> statement-breakpoint
ALTER TABLE `entity_media` ADD CONSTRAINT `entity_media_exactly_one_owner_check`
CHECK (((`product_id` IS NOT NULL) + (`offer_id` IS NOT NULL) + (`collection_id` IS NOT NULL)) = 1);
