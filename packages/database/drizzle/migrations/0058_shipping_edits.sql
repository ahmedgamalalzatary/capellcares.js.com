ALTER TABLE `shipping_work_items` MODIFY COLUMN `operation` enum('create_delivery','cancel_delivery','terminate_delivery','sync_delivery','edit_delivery') NOT NULL;
