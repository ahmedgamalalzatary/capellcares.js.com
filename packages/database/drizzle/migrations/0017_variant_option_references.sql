CREATE TEMPORARY TABLE `migration_0017_null_size_collision_guard` (
  `invalid` tinyint NOT NULL,
  CONSTRAINT `migration_0017_null_size_collision_guard_check` CHECK (`invalid` = 0)
);
--> statement-breakpoint
INSERT INTO `migration_0017_null_size_collision_guard` (`invalid`)
SELECT 1
FROM `product_variants` AS `null_variant`
INNER JOIN `product_variants` AS `labeled_variant`
  ON `labeled_variant`.`product_id` = `null_variant`.`product_id`
 AND `labeled_variant`.`size_label` = '__UNSPECIFIED__'
WHERE `null_variant`.`size_label` IS NULL
LIMIT 1;
--> statement-breakpoint
DROP TEMPORARY TABLE `migration_0017_null_size_collision_guard`;
--> statement-breakpoint
INSERT INTO `product_sizes` (`product_id`, `size_label`, `sort_order`)
SELECT `product_id`, COALESCE(`size_label`, '__UNSPECIFIED__'), MIN(`sort_order`)
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
 AND `size`.`size_label` <=> COALESCE(`variant`.`size_label`, '__UNSPECIFIED__')
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
