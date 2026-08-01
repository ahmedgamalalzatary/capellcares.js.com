ALTER TABLE `review_prompt_states` ADD `order_id` int;
--> statement-breakpoint
UPDATE `review_prompt_states` AS prompt_state
INNER JOIN `order_items` AS order_item ON order_item.`id` = prompt_state.`order_item_id`
SET prompt_state.`order_id` = order_item.`order_id`;
--> statement-breakpoint
ALTER TABLE `review_prompt_states` MODIFY COLUMN `order_id` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `review_prompt_states` ADD CONSTRAINT `review_prompt_states_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
DELETE duplicate_prompt
FROM `review_prompt_states` AS duplicate_prompt
INNER JOIN `review_prompt_states` AS retained_prompt
  ON retained_prompt.`customer_id` = duplicate_prompt.`customer_id`
  AND retained_prompt.`order_id` = duplicate_prompt.`order_id`
  AND retained_prompt.`id` < duplicate_prompt.`id`;
--> statement-breakpoint
ALTER TABLE `review_prompt_states` ADD CONSTRAINT `review_prompt_states_customer_order_unique` UNIQUE(`customer_id`,`order_id`);
