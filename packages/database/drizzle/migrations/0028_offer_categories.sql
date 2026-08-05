ALTER TABLE `offers`
  ADD COLUMN `category_id` int NULL AFTER `fixed_price`;
--> statement-breakpoint

ALTER TABLE `offers`
  ADD CONSTRAINT `offers_category_id_categories_id_fk`
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

-- Offers created before classification existed carry no category. They are
-- parked as inactive so an uncategorised offer can never reach the storefront;
-- an admin has to open each one, pick a root category and re-activate it.
-- Trashed rows are deactivated too: restoring one must not put it back live.
UPDATE `offers`
SET `status` = 'inactive'
WHERE `category_id` IS NULL;
