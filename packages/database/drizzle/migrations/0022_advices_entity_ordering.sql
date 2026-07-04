ALTER TABLE `entity_orderings`
  MODIFY COLUMN `entity_type` enum('category','product','offer','collection','advice') NOT NULL;
--> statement-breakpoint

INSERT INTO `entity_orderings` (`scope_type`, `scope_id`, `entity_type`, `entity_id`, `rank`)
SELECT
  'root',
  NULL,
  'advice',
  ranked.`id`,
  ranked.`rank`
FROM (
  SELECT
    `id`,
    ROW_NUMBER() OVER (ORDER BY `sort_order` ASC, `created_at` DESC, `id` ASC) AS `rank`
  FROM `advices`
) AS ranked
ON DUPLICATE KEY UPDATE `rank` = VALUES(`rank`);
--> statement-breakpoint

ALTER TABLE `advices`
  DROP COLUMN `sort_order`;
