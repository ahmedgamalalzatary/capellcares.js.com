-- One stored phone format (+965 then the 8-digit mobile number), matching normalizeKuwaitiPhone in @capella/shared.
-- Orders used to keep the phone as typed (55123456, 00965…, +965…). Promo first-order and per-customer checks look orders up by phone.
-- Only values that are a valid Kuwaiti mobile once spaces, dashes and brackets are removed are rewritten; anything else is left alone.
UPDATE `orders`
SET `phone` = CONCAT('+965', RIGHT(REGEXP_REPLACE(`phone`, '[[:space:]()-]', ''), 8))
WHERE REGEXP_REPLACE(`phone`, '[[:space:]()-]', '') REGEXP '^([+]965|00965)?[569][0-9]{7}$'
  AND `phone` <> CONCAT('+965', RIGHT(REGEXP_REPLACE(`phone`, '[[:space:]()-]', ''), 8));
