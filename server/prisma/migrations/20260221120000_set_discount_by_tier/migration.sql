UPDATE "Package"
SET "discountPercent" = CASE
  WHEN LOWER(COALESCE("badge", '')) LIKE '%basic%' OR LOWER("title") LIKE '%basic%' THEN 35
  WHEN LOWER(COALESCE("badge", '')) LIKE '%reguler%' OR LOWER(COALESCE("badge", '')) LIKE '%regular%'
    OR LOWER("title") LIKE '%reguler%' OR LOWER("title") LIKE '%regular%' THEN 40
  WHEN LOWER(COALESCE("badge", '')) LIKE '%exclusive%' OR LOWER(COALESCE("badge", '')) LIKE '%ultimate%'
    OR LOWER("title") LIKE '%exclusive%' OR LOWER("title") LIKE '%ultimate%' THEN 50
  ELSE "discountPercent"
END;
