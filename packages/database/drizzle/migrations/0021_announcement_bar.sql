CREATE TABLE `announcement_bar_settings` (
  `id` int NOT NULL,
  `is_enabled` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `announcement_bar_settings_id` PRIMARY KEY(`id`),
  CONSTRAINT `announcement_bar_settings_singleton_check` CHECK (`id` = 1)
);
--> statement-breakpoint
CREATE TABLE `announcement_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ar_text` varchar(500) NOT NULL,
  `en_text` varchar(500) NOT NULL,
  `is_active` boolean NOT NULL DEFAULT true,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `announcement_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `announcement_items_sort_order_check` CHECK (`sort_order` >= 0)
);
--> statement-breakpoint
INSERT INTO `announcement_bar_settings` (`id`, `is_enabled`) VALUES (1, true);
--> statement-breakpoint
INSERT INTO `announcement_items` (`ar_text`, `en_text`, `is_active`, `sort_order`) VALUES
  ('اشترِ ٣ زنوبة بـ ١١٩٩ جنيه', 'Get 3 Zanooba for 1199 EGP', true, 0),
  ('أي ٣ قطع EVA بـ ٩٩٩ جنيه فقط', 'Any 3 EVA Pieces for only 999 EGP', true, 1),
  ('القطعة الثانية -١٥٪ | الثالثة -٣٠٪ | شحن مجاني فوق ٨٠٠ جنيه | +١٥٪ بالبطاقة', '2nd item -15% | 3rd item -30% | Free Shipping 800+ EGP | +15% with Card', true, 2),
  ('اشترِ ٣ كلاسيك بـ ١١٩٩ جنيه', 'Get 3 Classics for 1199 EGP', true, 3);
