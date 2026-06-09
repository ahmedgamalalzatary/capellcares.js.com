ALTER TABLE `categories` DROP INDEX `categories_slug_unique`;
--> statement-breakpoint
ALTER TABLE `categories` ADD `parent_scope_id` int GENERATED ALWAYS AS (coalesce(`parent_id`, 0)) STORED;
--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_scope_slug_unique` UNIQUE(`parent_scope_id`,`slug`);
