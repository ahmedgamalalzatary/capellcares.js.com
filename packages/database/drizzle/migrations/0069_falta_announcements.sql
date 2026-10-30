-- The announcement bar's first messages were Capella's. Rows staff have since edited are left alone.
UPDATE `announcements` SET `ar_text` = 'توصيل مجاني لكل الطلبات', `en_text` = 'Free delivery on every order' WHERE `en_text` = 'Free Cairo delivery on orders over EGP 600';
--> statement-breakpoint
UPDATE `announcements` SET `ar_text` = 'ادفع نقدًا عند وصول طلبك', `en_text` = 'Pay cash when your order arrives' WHERE `en_text` = 'Cash on delivery available nationwide';
--> statement-breakpoint
UPDATE `announcements` SET `ar_text` = 'وصلت ألعاب جديدة', `en_text` = 'New toys just landed' WHERE `en_text` = 'New season essentials just landed';
--> statement-breakpoint
DELETE FROM `announcements` WHERE `en_text` = 'Honest, dermatologist-loved formulas';
