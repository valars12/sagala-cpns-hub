CREATE TABLE "TryoutAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "answeredCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "blankCount" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "perCategory" TEXT NOT NULL,
    "answers" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TryoutAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TryoutAttempt_userId_completedAt_idx" ON "TryoutAttempt"("userId", "completedAt" DESC);
CREATE INDEX "TryoutAttempt_packageId_idx" ON "TryoutAttempt"("packageId");

ALTER TABLE "TryoutAttempt"
ADD CONSTRAINT "TryoutAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TryoutAttempt"
ADD CONSTRAINT "TryoutAttempt_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
