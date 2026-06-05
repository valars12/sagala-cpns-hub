-- AlterTable
ALTER TABLE "Package"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 50;

