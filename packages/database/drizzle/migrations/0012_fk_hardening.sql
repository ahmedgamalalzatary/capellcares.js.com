-- 0012 FK hardening for obvious non-polymorphic relationships.
-- Keep cleanup narrow: remove only rows that would block these constraints, and
-- preserve historical orders by nulling broken optional customer references.

DELETE s FROM `auth_sessions` s
LEFT JOIN `customers` c ON c.`id` = s.`customer_id`
WHERE s.`customer_id` IS NOT NULL AND c.`id` IS NULL;
--> statement-breakpoint

DELETE s FROM `auth_sessions` s
LEFT JOIN `admin_users` a ON a.`id` = s.`admin_user_id`
WHERE s.`admin_user_id` IS NOT NULL AND a.`id` IS NULL;
--> statement-breakpoint

DELETE w FROM `wishlists` w
LEFT JOIN `customers` c ON c.`id` = w.`customer_id`
WHERE c.`id` IS NULL;
--> statement-breakpoint

DELETE w FROM `wishlists` w
LEFT JOIN `products` p ON p.`id` = w.`product_id`
WHERE p.`id` IS NULL;
--> statement-breakpoint

UPDATE `orders` o
LEFT JOIN `customers` c ON c.`id` = o.`customer_id`
SET o.`customer_id` = NULL
WHERE o.`customer_id` IS NOT NULL AND c.`id` IS NULL;
--> statement-breakpoint

ALTER TABLE `auth_sessions`
  ADD CONSTRAINT `auth_sessions_customer_id_customers_id_fk`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE `auth_sessions`
  ADD CONSTRAINT `auth_sessions_admin_user_id_admin_users_id_fk`
  FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`)
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE `wishlists`
  ADD CONSTRAINT `wishlists_customer_id_customers_id_fk`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE `wishlists`
  ADD CONSTRAINT `wishlists_product_id_products_id_fk`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_customer_id_customers_id_fk`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
  ON DELETE set null ON UPDATE no action;
