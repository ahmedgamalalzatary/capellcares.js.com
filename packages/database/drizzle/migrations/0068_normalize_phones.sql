-- One stored phone format (+20 then the 10-digit mobile number), matching normalizeEgyptianPhone in @capella/shared.
-- COD orders used to keep the phone as typed (010…, 0020…, with spaces or dashes); Paymob sessions were already +20….
-- Only values that are a valid Egyptian mobile once spaces, dashes and brackets are removed are rewritten; anything else is left alone.
UPDATE `orders`
SET `phone` = CONCAT('+20', RIGHT(REGEXP_REPLACE(`phone`, '[[:space:]()-]', ''), 10))
WHERE REGEXP_REPLACE(`phone`, '[[:space:]()-]', '') REGEXP '^([+]20|0020|0)?1[0125][0-9]{8}$'
  AND `phone` <> CONCAT('+20', RIGHT(REGEXP_REPLACE(`phone`, '[[:space:]()-]', ''), 10));
--> statement-breakpoint
UPDATE `checkout_sessions`
SET `phone` = CONCAT('+20', RIGHT(REGEXP_REPLACE(`phone`, '[[:space:]()-]', ''), 10))
WHERE REGEXP_REPLACE(`phone`, '[[:space:]()-]', '') REGEXP '^([+]20|0020|0)?1[0125][0-9]{8}$'
  AND `phone` <> CONCAT('+20', RIGHT(REGEXP_REPLACE(`phone`, '[[:space:]()-]', ''), 10));
