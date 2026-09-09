CREATE TABLE `announcements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ar_text` varchar(255) NOT NULL,
  `en_text` varchar(255) NOT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

INSERT INTO `announcements` (`ar_text`, `en_text`, `status`, `sort_order`)
VALUES
  ('شحن مجاني داخل القاهرة للطلبات فوق ٦٠٠ جنيه', 'Free Cairo delivery on orders over EGP 600', 'active', 1),
  ('الدفع عند الاستلام متاح في كل المحافظات', 'Cash on delivery available nationwide', 'active', 2),
  ('وصل حديثًا: أساسيات الموسم الجديد', 'New season essentials just landed', 'active', 3),
  ('تركيبات صادقة يوصي بها أطباء الجلدية', 'Honest, dermatologist-loved formulas', 'active', 4);
