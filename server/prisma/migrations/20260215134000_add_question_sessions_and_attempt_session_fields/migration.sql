ALTER TABLE "Question"
ADD COLUMN "sessionType" TEXT NOT NULL DEFAULT 'TRYOUT',
ADD COLUMN "sessionCode" TEXT NOT NULL DEFAULT 'TRYOUT-1',
ADD COLUMN "sessionTitle" TEXT NOT NULL DEFAULT 'Tryout 1',
ADD COLUMN "sessionOrder" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Question_packageId_sessionCode_idx" ON "Question"("packageId", "sessionCode");
CREATE INDEX "Question_packageId_sessionType_sessionOrder_idx" ON "Question"("packageId", "sessionType", "sessionOrder");

ALTER TABLE "TryoutAttempt"
ADD COLUMN "sessionType" TEXT NOT NULL DEFAULT 'TRYOUT',
ADD COLUMN "sessionCode" TEXT,
ADD COLUMN "sessionTitle" TEXT;
