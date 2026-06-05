ALTER TABLE "Question"
ADD COLUMN "questionOrder" INTEGER NOT NULL DEFAULT 1;

WITH ranked_questions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "packageId", "sessionType", "sessionOrder"
      ORDER BY "createdAt" ASC, id ASC
    ) AS row_number
  FROM "Question"
)
UPDATE "Question" AS question
SET "questionOrder" = ranked_questions.row_number
FROM ranked_questions
WHERE question.id = ranked_questions.id;

CREATE INDEX "Question_packageId_sessionType_sessionOrder_questionOrder_idx"
ON "Question"("packageId", "sessionType", "sessionOrder", "questionOrder");
