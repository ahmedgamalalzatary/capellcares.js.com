ALTER TABLE `product_variants`
  ADD CONSTRAINT `product_variants_price_nonnegative_check` CHECK (`selling_price` >= 0);
