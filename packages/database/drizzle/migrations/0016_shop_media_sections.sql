CREATE TABLE `shop_media_sections` (
  `id` int AUTO_INCREMENT NOT NULL,
  `slot` int NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `shop_media_sections_id` PRIMARY KEY(`id`),
  CONSTRAINT `shop_media_sections_slot_unique` UNIQUE(`slot`)
);
--> statement-breakpoint

CREATE TABLE `shop_media_section_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `section_id` int NOT NULL,
  `image_path` varchar(1024) NOT NULL,
  `target_type` enum('shop','new','bestsellers','products','product','offers','offer','collections','collection','category') NOT NULL,
  `target_id` int,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `shop_media_section_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `shop_media_section_items_section_id_shop_media_sections_id_fk`
    FOREIGN KEY (`section_id`) REFERENCES `shop_media_sections`(`id`) ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `shop_media_sections` (`slot`, `status`)
VALUES (1, 'inactive'), (2, 'inactive'), (3, 'inactive');
