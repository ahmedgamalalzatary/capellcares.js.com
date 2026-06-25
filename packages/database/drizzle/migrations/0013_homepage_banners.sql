CREATE TABLE `homepage_banner_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `section_key` enum('hero_primary','grid_featured','single_mid','hero_secondary','single_footer') NOT NULL,
  `image_path` varchar(1024) NOT NULL,
  `href` varchar(1024) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `homepage_banner_items_id` PRIMARY KEY(`id`)
);
