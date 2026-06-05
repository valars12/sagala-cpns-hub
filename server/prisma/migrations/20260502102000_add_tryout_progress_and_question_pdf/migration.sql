ALTER TABLE "Question"
ADD COLUMN "promptPdfDataUrl" TEXT,
ADD COLUMN "promptPdfFileName" TEXT;

CREATE TABLE "TryoutProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL DEFAULT 'TRYOUT',
    "sessionCode" TEXT NOT NULL,
    "sessionTitle" TEXT,
    "sessionOrder" INTEGER NOT NULL DEFAULT 1,
    "totalQuestions" INTEGER NOT NULL,
    "totalDurationSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "activeQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "answers" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TryoutProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TryoutProgress_userId_packageId_sessionType_sessionOrder_key"
ON "TryoutProgress"("userId", "packageId", "sessionType", "sessionOrder");

CREATE INDEX "TryoutProgress_userId_updatedAt_idx"
ON "TryoutProgress"("userId", "updatedAt" DESC);

CREATE INDEX "TryoutProgress_packageId_idx"
ON "TryoutProgress"("packageId");

ALTER TABLE "TryoutProgress"
ADD CONSTRAINT "TryoutProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TryoutProgress"
ADD CONSTRAINT "TryoutProgress_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
