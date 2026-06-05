-- CreateTable
CREATE TABLE "ClassTryoutAssignment" (
    "id" TEXT NOT NULL,
    "studyClassId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL DEFAULT 'TRYOUT',
    "sessionOrder" INTEGER NOT NULL DEFAULT 1,
    "sessionCode" TEXT,
    "sessionTitle" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassTryoutAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBackup" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "questionId" TEXT,
    "packageId" TEXT,
    "packageTitle" TEXT,
    "sessionType" TEXT,
    "sessionOrder" INTEGER,
    "sessionCode" TEXT,
    "sessionTitle" TEXT,
    "category" TEXT,
    "subtestTitle" TEXT,
    "promptExcerpt" TEXT,
    "snapshot" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredById" TEXT,
    "restoredByName" TEXT,
    "restoredQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassTryoutAssignment_studyClassId_packageId_sessionType_sessionOrder_idx"
ON "ClassTryoutAssignment"("studyClassId", "packageId", "sessionType", "sessionOrder");

-- CreateIndex
CREATE INDEX "ClassTryoutAssignment_packageId_sessionType_sessionOrder_idx"
ON "ClassTryoutAssignment"("packageId", "sessionType", "sessionOrder");

-- CreateIndex
CREATE INDEX "ClassTryoutAssignment_startAt_endAt_idx"
ON "ClassTryoutAssignment"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "QuestionBackup_questionId_createdAt_idx"
ON "QuestionBackup"("questionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QuestionBackup_packageId_createdAt_idx"
ON "QuestionBackup"("packageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QuestionBackup_action_createdAt_idx"
ON "QuestionBackup"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QuestionBackup_createdAt_idx"
ON "QuestionBackup"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ClassTryoutAssignment"
ADD CONSTRAINT "ClassTryoutAssignment_studyClassId_fkey"
FOREIGN KEY ("studyClassId") REFERENCES "StudyClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTryoutAssignment"
ADD CONSTRAINT "ClassTryoutAssignment_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTryoutAssignment"
ADD CONSTRAINT "ClassTryoutAssignment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
