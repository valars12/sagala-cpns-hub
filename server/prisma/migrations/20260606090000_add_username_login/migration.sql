ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User"
SET "username" = lower(
  regexp_replace(
    regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9._-]+', '_', 'g'),
    '^_+|_+$',
    '',
    'g'
  )
) || '_' || substr("id", 1, 6)
WHERE "username" IS NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
