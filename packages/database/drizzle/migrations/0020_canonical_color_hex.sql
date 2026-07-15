UPDATE `product_colors` SET `color_hex` = UPPER(`color_hex`);
--> statement-breakpoint
ALTER TABLE `product_colors`
  DROP CHECK `product_colors_canonical_hex_check`,
  ADD CONSTRAINT `product_colors_canonical_hex_check`
    CHECK (
      BINARY `color_hex` = BINARY UPPER(`color_hex`)
      AND `color_hex` REGEXP '^#[0-9A-F]{6}$'
    );
