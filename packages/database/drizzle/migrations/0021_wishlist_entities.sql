ALTER TABLE `wishlists`
  ADD COLUMN `entity_type` enum('product','offer','collection') NOT NULL AFTER `customer_id`,
  ADD COLUMN `entity_id` int NOT NULL AFTER `entity_type`;
--> statement-breakpoint

UPDATE `wishlists`
SET
  `entity_type` = 'product',
  `entity_id` = `product_id`;
--> statement-breakpoint

ALTER TABLE `wishlists`
  DROP FOREIGN KEY `wishlists_product_id_products_id_fk`;
--> statement-breakpoint

ALTER TABLE `wishlists`
  ADD INDEX `wishlists_customer_id_idx` (`customer_id`);
--> statement-breakpoint

ALTER TABLE `wishlists`
  DROP INDEX `wishlists_customer_product_unique`;
--> statement-breakpoint

ALTER TABLE `wishlists`
  DROP COLUMN `product_id`;
--> statement-breakpoint

ALTER TABLE `wishlists`
  ADD CONSTRAINT `wishlists_customer_entity_unique`
  UNIQUE (`customer_id`, `entity_type`, `entity_id`);
