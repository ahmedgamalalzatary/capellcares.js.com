INSERT INTO `product_sizes` (`product_id`, `size_label`, `sort_order`)
SELECT `product_id`, `size_label`, MIN(`sort_order`)
FROM `product_variants`
GROUP BY `product_id`, `size_label`;
--> statement-breakpoint
ALTER TABLE `product_variants`
  ADD `size_id` int,
  ADD `color_id` int;
--> statement-breakpoint
UPDATE `product_variants` AS `variant`
INNER JOIN `product_sizes` AS `size`
  ON `size`.`product_id` = `variant`.`product_id`
 AND `size`.`size_label` = `variant`.`size_label`
SET `variant`.`size_id` = `size`.`id`;
--> statement-breakpoint
ALTER TABLE `product_variants`
  DROP INDEX `product_variants_active_size_unique`,
  DROP COLUMN `active_size_label`,
  DROP COLUMN `size_label`,
  MODIFY `size_id` int NOT NULL,
  ADD `active_size_id` int GENERATED ALWAYS AS (
    CASE WHEN `deleted_at` IS NULL THEN `size_id` ELSE NULL END
  ) STORED,
  ADD `active_color_scope_id` int GENERATED ALWAYS AS (
    CASE WHEN `deleted_at` IS NULL THEN COALESCE(`color_id`, 0) ELSE NULL END
  ) STORED,
  ADD CONSTRAINT `product_variants_active_combination_unique`
    UNIQUE (`product_id`, `active_size_id`, `active_color_scope_id`),
  ADD CONSTRAINT `product_variants_size_product_fk`
    FOREIGN KEY (`size_id`, `product_id`)
    REFERENCES `product_sizes` (`id`, `product_id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `product_variants_color_product_fk`
    FOREIGN KEY (`color_id`, `product_id`)
    REFERENCES `product_colors` (`id`, `product_id`) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE `order_items`
  ADD `snapshot_color_hex` varchar(7);
