UPDATE `product_variants` SET `stock_qty` = 0 WHERE `stock_qty` < 0;
--> statement-breakpoint

ALTER TABLE `product_variants`
  ADD CONSTRAINT `product_variants_stock_nonnegative_check` CHECK (`stock_qty` >= 0);
