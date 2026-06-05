ALTER TABLE "User"
ADD COLUMN "registrationSource" TEXT NOT NULL DEFAULT 'UNKNOWN';

UPDATE "User"
SET "registrationSource" = 'ADMIN_CREATED'
WHERE "role" IN ('admin', 'teacher');

UPDATE "User"
SET "registrationSource" = 'SELF_REGISTERED'
WHERE "role" = 'student'
  AND (
    "provider" = 'GOOGLE'
    OR "isValidated" = false
  );
