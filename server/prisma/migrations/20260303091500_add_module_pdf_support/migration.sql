-- AlterTable
ALTER TABLE "Module"
ADD COLUMN "pdfDataUrl" TEXT,
ADD COLUMN "pdfFileName" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
