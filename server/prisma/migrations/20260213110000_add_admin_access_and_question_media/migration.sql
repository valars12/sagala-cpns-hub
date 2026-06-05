ALTER TABLE "Purchase"
ADD COLUMN "isAdminGranted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Question"
ADD COLUMN "subtestTitle" TEXT NOT NULL DEFAULT 'Subtest Umum',
ADD COLUMN "promptImageUrl" TEXT,
ADD COLUMN "explanationImageUrl" TEXT;
