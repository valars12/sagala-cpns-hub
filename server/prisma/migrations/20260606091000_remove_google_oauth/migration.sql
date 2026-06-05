UPDATE "User"
SET "provider" = 'STANDARD'
WHERE "provider" = 'GOOGLE';

DROP INDEX IF EXISTS "User_googleId_key";

ALTER TABLE "User" DROP COLUMN IF EXISTS "googleId";
